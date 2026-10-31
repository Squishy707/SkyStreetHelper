"""
Bazaar Order Tracker Service:
Inspects active Bazaar orders, order book depth queues, outbid status, and fill estimation.
"""

from typing import Dict, Any, List, Optional
import math

def clean_item_display_name(item_id: str) -> str:
    """Formats raw item ID (e.g. ENCHANTED_COOKIE) into a readable English name."""
    if not item_id:
        return "Unknown Item"
    parts = item_id.split('_')
    formatted = []
    for p in parts:
        p_lower = p.lower()
        if p_lower in ("t0", "t1", "t2"):
            formatted.append(f"({p.upper()})")
        else:
            formatted.append(p.capitalize())
    return " ".join(formatted)

class TrackerService:
    def __init__(self):
        pass

    def search_products(self, products: Dict[str, Any], query: str, limit: int = 25) -> List[Dict[str, Any]]:
        """
        Searches products in Bazaar cache by ID or readable title.
        """
        if not products:
            return []
            
        q = (query or "").strip().upper()
        results = []
        
        for item_id, p_data in products.items():
            disp_name = clean_item_display_name(item_id)
            if not q or (q in item_id) or (q in disp_name.upper()):
                qs = p_data.get("quick_status", {})
                sell_sum = p_data.get("sell_summary", [])
                buy_sum = p_data.get("buy_summary", [])
                
                top_bo = sell_sum[0]["pricePerUnit"] if sell_sum else float(qs.get("buyPrice", 0.0) or 0.0)
                top_ib = buy_sum[0]["pricePerUnit"] if buy_sum else float(qs.get("sellPrice", 0.0) or 0.0)
                
                results.append({
                    "id": item_id,
                    "name": disp_name,
                    "top_buy_order": round(top_bo, 1),
                    "top_sell_offer": round(top_ib, 1),
                    "weekly_volume": int((qs.get("buyMovingWeek", 0) or 0) + (qs.get("sellMovingWeek", 0) or 0))
                })
                
                if len(results) >= limit * 2:
                    break
                    
        # Sort matches by weekly volume descending so popular items appear first
        results.sort(key=lambda x: x["weekly_volume"], reverse=True)
        return results[:limit]

    def inspect_orders(self, products: Dict[str, Any], orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Inspects a list of user orders against live Bazaar products data.
        """
        inspected = []
        for ord_info in orders:
            order_id = ord_info.get("id", "")
            item_id = str(ord_info.get("item_id", "")).strip().upper()
            order_type = ord_info.get("order_type", "buy_order")  # 'buy_order' or 'sell_offer'
            target_price = float(ord_info.get("target_price", 0.0) or 0.0)
            initial_qty = int(ord_info.get("initial_quantity", 0) or 0)
            prev_rank = ord_info.get("previous_rank")
            prev_filled = ord_info.get("previous_filled", 0)
            
            p_data = products.get(item_id)
            if not p_data:
                inspected.append({
                    "id": order_id,
                    "item_id": item_id,
                    "item_name": clean_item_display_name(item_id),
                    "order_type": order_type,
                    "target_price": target_price,
                    "initial_quantity": initial_qty,
                    "found_in_book": False,
                    "status": "ITEM_NOT_FOUND",
                    "status_label": "标的不存在",
                    "rank": None,
                    "top_price": 0.0,
                    "price_gap": 0.0,
                    "reclaim_price": 0.0,
                    "ahead_volume": 0,
                    "ahead_orders": 0,
                    "current_tier_amount": 0,
                    "current_tier_orders": 0,
                    "estimated_filled": 0,
                    "fill_percentage": 0.0,
                    "needs_alert": False,
                    "alert_type": None,
                    "alert_msg": ""
                })
                continue
                
            is_buy = (order_type == "buy_order")
            # In Hypixel Bazaar:
            # sell_summary: Buy Orders awaiting sellers (highest price has matching priority #1)
            # buy_summary: Sell Offers awaiting buyers (lowest price has matching priority #1)
            book = p_data.get("sell_summary", []) if is_buy else p_data.get("buy_summary", [])
            
            top_price = book[0]["pricePerUnit"] if book else 0.0
            
            # Find tier
            found_idx = -1
            for i, tier in enumerate(book):
                tier_price = float(tier.get("pricePerUnit", 0.0))
                # Match price within 0.05 tolerance to avoid float inaccuracies
                if abs(tier_price - target_price) < 0.05:
                    found_idx = i
                    break
                    
            if found_idx != -1:
                # Target price tier is currently active in the top depth book!
                rank = found_idx + 1
                ahead_vol = sum(t.get("amount", 0) for t in book[:found_idx])
                ahead_orders = sum(t.get("orders", 0) for t in book[:found_idx])
                
                my_tier = book[found_idx]
                tier_amount = int(my_tier.get("amount", 0))
                tier_orders = int(my_tier.get("orders", 0))
                
                # Fill estimation:
                # If target price tier has amount less than initial_qty, the difference has likely been fulfilled
                # (or partially fulfilled / partly cancelled)
                estimated_filled = max(0, initial_qty - tier_amount)
                fill_pct = min(100.0, round((estimated_filled / initial_qty) * 100, 1)) if initial_qty > 0 else 0.0
                
                # Price gap & Reclaim suggestion
                if is_buy:
                    gap = round(top_price - target_price, 2)
                    reclaim_price = round(top_price + 0.1, 1)
                else:
                    gap = round(target_price - top_price, 2)
                    reclaim_price = max(0.1, round(top_price - 0.1, 1))
                    
                # Status evaluation
                if rank == 1:
                    status = "LEADING"
                    status_label = "队首最优 (优先撮合)"
                elif rank <= 3:
                    status = "QUEUED"
                    status_label = f"排队 #{rank} (微幅受阻)"
                elif rank <= 10:
                    status = "OUTBID"
                    status_label = f"被超越 #{rank} (竞争压价)"
                else:
                    status = "OUTBID_DEEP"
                    status_label = f"深度压盘 #{rank}"
                    
                # Alert triggers
                needs_alert = False
                alert_type = None
                alert_msg = ""
                
                # Check outbid alert: newly dropped from #1 or dropped significantly
                if prev_rank is not None and prev_rank == 1 and rank > 1:
                    needs_alert = True
                    alert_type = "outbid"
                    alert_msg = f"{clean_item_display_name(item_id)} 挂单已被超越！当前跌至 #{rank} 顺位，榜首竞价为 {top_price:,.1f} C (差价 {gap:+.1f} C)"
                elif estimated_filled > (prev_filled or 0) and estimated_filled < initial_qty:
                    needs_alert = True
                    alert_type = "progress"
                    diff_filled = estimated_filled - (prev_filled or 0)
                    alert_msg = f"{clean_item_display_name(item_id)} 成交推进 +{diff_filled:,} 颗 (进度: {fill_pct:.1f}%)"
                elif estimated_filled >= initial_qty and initial_qty > 0:
                    needs_alert = True
                    alert_type = "filled"
                    status = "FILLED"
                    status_label = "100% 已完全成交"
                    alert_msg = f"{clean_item_display_name(item_id)} 订单已 100% 全部成交 (共 {initial_qty:,} 颗)！"
                    
                inspected.append({
                    "id": order_id,
                    "item_id": item_id,
                    "item_name": clean_item_display_name(item_id),
                    "order_type": order_type,
                    "target_price": target_price,
                    "initial_quantity": initial_qty,
                    "found_in_book": True,
                    "status": status,
                    "status_label": status_label,
                    "rank": rank,
                    "top_price": round(top_price, 1),
                    "price_gap": gap,
                    "reclaim_price": reclaim_price,
                    "ahead_volume": ahead_vol,
                    "ahead_orders": ahead_orders,
                    "current_tier_amount": tier_amount,
                    "current_tier_orders": tier_orders,
                    "estimated_filled": estimated_filled,
                    "fill_percentage": fill_pct,
                    "needs_alert": needs_alert,
                    "alert_type": alert_type,
                    "alert_msg": alert_msg
                })
            else:
                # Target price tier is NOT found in the top depth book!
                # Determine whether it was fully filled, or displaced beyond depth
                book_depth = len(book)
                lowest_or_highest_in_book = book[-1]["pricePerUnit"] if book else 0.0
                
                # For Buy Order:
                # If market prices in depth are all > target_price and depth == 30, it got pushed out of the 30 tiers window.
                # If market price moved below or user had high fill progress, it was completely cleared/filled!
                if is_buy:
                    if book_depth >= 25 and lowest_or_highest_in_book > target_price:
                        status = "OUTBID_DEEP"
                        status_label = "深度脱离盘口 (被压在30档外)"
                        gap = round(top_price - target_price, 2)
                        reclaim_price = round(top_price + 0.1, 1)
                        estimated_filled = prev_filled or 0
                    else:
                        # Price tier is gone: either completely filled or cancelled
                        status = "FILLED"
                        status_label = "已出盘口 / 判定已成交"
                        gap = 0.0
                        reclaim_price = round(top_price + 0.1, 1)
                        estimated_filled = initial_qty
                else:
                    if book_depth >= 25 and lowest_or_highest_in_book < target_price:
                        status = "OUTBID_DEEP"
                        status_label = "深度脱离盘口 (被压在30档外)"
                        gap = round(target_price - top_price, 2)
                        reclaim_price = max(0.1, round(top_price - 0.1, 1))
                        estimated_filled = prev_filled or 0
                    else:
                        status = "FILLED"
                        status_label = "已出盘口 / 判定已成交"
                        gap = 0.0
                        reclaim_price = max(0.1, round(top_price - 0.1, 1))
                        estimated_filled = initial_qty
                        
                fill_pct = 100.0 if status == "FILLED" else (min(100.0, round(((prev_filled or 0) / initial_qty) * 100, 1)) if initial_qty > 0 else 0.0)
                
                needs_alert = False
                alert_type = None
                alert_msg = ""
                if status == "FILLED" and (prev_filled or 0) < initial_qty:
                    needs_alert = True
                    alert_type = "filled"
                    alert_msg = f"{clean_item_display_name(item_id)} 挂单已脱离盘口，判定 100% 完全成交 (共 {initial_qty:,} 颗)！"
                    
                inspected.append({
                    "id": order_id,
                    "item_id": item_id,
                    "item_name": clean_item_display_name(item_id),
                    "order_type": order_type,
                    "target_price": target_price,
                    "initial_quantity": initial_qty,
                    "found_in_book": False,
                    "status": status,
                    "status_label": status_label,
                    "rank": None,
                    "top_price": round(top_price, 1),
                    "price_gap": gap,
                    "reclaim_price": reclaim_price,
                    "ahead_volume": 0,
                    "ahead_orders": 0,
                    "current_tier_amount": 0,
                    "current_tier_orders": 0,
                    "estimated_filled": estimated_filled,
                    "fill_percentage": fill_pct,
                    "needs_alert": needs_alert,
                    "alert_type": alert_type,
                    "alert_msg": alert_msg
                })
                
        return inspected

    def get_order_book_depth(
        self,
        products: Dict[str, Any],
        item_id: str,
        target_price: Optional[float] = None,
        order_type: str = "buy_order",
        depth: int = 20
    ) -> Dict[str, Any]:
        """
        Returns the detailed top depth order book for an item, marking the user's tier.
        """
        item_id = (item_id or "").strip().upper()
        p_data = products.get(item_id, {})
        if not p_data:
            return {"success": False, "error": f"Item '{item_id}' not found"}
            
        sell_sum = p_data.get("sell_summary", [])  # Buy Orders
        buy_sum = p_data.get("buy_summary", [])    # Sell Offers
        
        target_p = float(target_price) if target_price is not None else None
        
        # Process Buy Orders side
        formatted_bids = []
        cum_bids = 0
        for i, t in enumerate(sell_sum[:depth]):
            p = float(t.get("pricePerUnit", 0.0))
            amt = int(t.get("amount", 0))
            ords = int(t.get("orders", 0))
            cum_bids += amt
            is_user = (order_type == "buy_order" and target_p is not None and abs(p - target_p) < 0.05)
            formatted_bids.append({
                "rank": i + 1,
                "price": round(p, 1),
                "amount": amt,
                "orders": ords,
                "cumulative_amount": cum_bids,
                "is_user_tier": is_user
            })
            
        # Process Sell Offers side
        formatted_asks = []
        cum_asks = 0
        for i, t in enumerate(buy_sum[:depth]):
            p = float(t.get("pricePerUnit", 0.0))
            amt = int(t.get("amount", 0))
            ords = int(t.get("orders", 0))
            cum_asks += amt
            is_user = (order_type == "sell_offer" and target_p is not None and abs(p - target_p) < 0.05)
            formatted_asks.append({
                "rank": i + 1,
                "price": round(p, 1),
                "amount": amt,
                "orders": ords,
                "cumulative_amount": cum_asks,
                "is_user_tier": is_user
            })
            
        qs = p_data.get("quick_status", {})
        
        return {
            "success": True,
            "item_id": item_id,
            "item_name": clean_item_display_name(item_id),
            "target_price": target_p,
            "order_type": order_type,
            "buy_orders": formatted_bids,
            "sell_offers": formatted_asks,
            "quick_status": {
                "buyPrice": round(float(qs.get("buyPrice", 0.0) or 0.0), 1),
                "sellPrice": round(float(qs.get("sellPrice", 0.0) or 0.0), 1),
                "buyVolume": int(qs.get("buyVolume", 0) or 0),
                "sellVolume": int(qs.get("sellVolume", 0) or 0),
                "buyOrders": int(qs.get("buyOrders", 0) or 0),
                "sellOrders": int(qs.get("sellOrders", 0) or 0)
            }
        }

tracker_service = TrackerService()
