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
                
                # Detect fill mode (倾销扫盘 vs 散户自然微量撮合)
                fill_mode = "none"
                fill_mode_label = "挂单排队中"
                delta_filled = estimated_filled - (prev_filled or 0)
                if delta_filled > 0:
                    if delta_filled >= 1000 or (initial_qty > 0 and (delta_filled / initial_qty) >= 0.3):
                        fill_mode = "dumper"
                        fill_mode_label = f"倾销扫盘吃单 (+{delta_filled:,} 颗)"
                    else:
                        fill_mode = "retail"
                        fill_mode_label = f"散户自然撮合 (+{delta_filled:,} 颗)"
                
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
                elif delta_filled > 0 and estimated_filled < initial_qty:
                    needs_alert = True
                    alert_type = "progress"
                    alert_msg = f"{clean_item_display_name(item_id)} {fill_mode_label} (总进度: {fill_pct:.1f}%)"
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
                    "fill_mode": fill_mode,
                    "fill_mode_label": fill_mode_label,
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
                # Target price tier is NOT found in the depth book!
                # 精细化脱离盘口判定：
                # 1. 倾销扫盘判定 (Dumper Sweep):
                #    Buy Order: 榜首最高买价 top_price 已跌穿 target_price (top_price < target_price - 0.05)
                #               说明有巨量倾销者把高于和等于 target_price 的买单全部砸穿吃光！
                #    Sell Offer: 榜首最低卖价 top_price 已升穿 target_price (top_price > target_price + 0.05)
                #               说明有大买家把低于和等于 target_price 的卖单全部扫货吃光！
                # 2. 队首自然撮合 (Natural Fulfillment at Rank #1):
                #    prev_rank == 1: 挂单处于队列最前端，自然被散户 Insta-Sell/Insta-Buy 撮合消化完毕。
                # 3. 深度压盘脱离 (Pushed beyond 30-depth window):
                #    len(book) >= 25 且末位价格仍处于不利方向（Buy单时末档价格 > target_price，Sell单时末档价格 < target_price）
                #    说明被30档以上的新增挂单挤出视窗，并未真正成交或撤单。
                # 4. 非榜一脱离 / 主动撤单 (Cancelled by User):
                #    prev_rank > 1 且前方更有利的挂单依然存在 (如 Buy单时 top_price > target_price)
                #    由于散户即时交易必须先撮合前方更优价单，在前方价单未被消化的前提下，中间价单消失只能是用户主动 Cancel 撤单！
                
                book_depth = len(book)
                lowest_or_highest_in_book = book[-1]["pricePerUnit"] if book else 0.0
                
                status = "FILLED"
                status_label = "已出盘口 / 判定已成交"
                fill_mode = "retail"
                fill_mode_label = "队首散户自然撮合"
                estimated_filled = initial_qty
                fill_pct = 100.0
                needs_alert = False
                alert_type = None
                alert_msg = ""
                
                if is_buy:
                    gap = max(0.0, round(top_price - target_price, 2))
                    reclaim_price = round(top_price + 0.1, 1)
                    
                    if top_price < (target_price - 0.05):
                        # 1. 倾销扫盘吞并
                        status = "FILLED"
                        status_label = "已完全成交 (倾销砸盘穿透)"
                        fill_mode = "dumper"
                        fill_mode_label = "检测到倾销大单砸盘穿透"
                        estimated_filled = initial_qty
                        fill_pct = 100.0
                        needs_alert = (prev_filled or 0) < initial_qty
                        alert_type = "filled"
                        alert_msg = f"{clean_item_display_name(item_id)} 遭遇倾销者大单砸盘扫过挂单价，已 100% 全部成交！"
                    elif prev_rank == 1:
                        # 2. 队首自然撮合
                        status = "FILLED"
                        status_label = "已完全成交 (队首自然撮合)"
                        fill_mode = "retail"
                        fill_mode_label = "队首散户散单撮合完毕"
                        estimated_filled = initial_qty
                        fill_pct = 100.0
                        needs_alert = (prev_filled or 0) < initial_qty
                        alert_type = "filled"
                        alert_msg = f"{clean_item_display_name(item_id)} 挂单在队首顺位完成撮合，100% 完全成交！"
                    elif book_depth >= 25 and lowest_or_highest_in_book > (target_price + 0.05):
                        # 3. 深度压盘脱离
                        status = "OUTBID_DEEP"
                        status_label = "深度脱离盘口 (被压在30档外)"
                        fill_mode = "none"
                        fill_mode_label = "已被新竞价压出30档外"
                        estimated_filled = prev_filled or 0
                        fill_pct = min(100.0, round(((prev_filled or 0) / initial_qty) * 100, 1)) if initial_qty > 0 else 0.0
                        needs_alert = True
                        alert_type = "outbid"
                        alert_msg = f"{clean_item_display_name(item_id)} 挂单已被新竞价压出前30档盘口深度，请及时提价夺回！"
                    else:
                        # 4. 非榜一脱离 -> 主动撤单
                        status = "CANCELLED"
                        status_label = "挂单已撤销 (非队首脱离)"
                        fill_mode = "cancelled"
                        fill_mode_label = "非队首脱离，判定为已主动撤单"
                        estimated_filled = prev_filled or 0
                        fill_pct = min(100.0, round(((prev_filled or 0) / initial_qty) * 100, 1)) if initial_qty > 0 else 0.0
                        needs_alert = True
                        alert_type = "cancelled"
                        alert_msg = f"{clean_item_display_name(item_id)} 挂单在第 #{prev_rank or '?'} 顺位脱离盘口 (前方高价单仍在)，判定为已主动撤单。"
                else:
                    # Sell Offer side
                    gap = max(0.0, round(target_price - top_price, 2))
                    reclaim_price = max(0.1, round(top_price - 0.1, 1))
                    
                    if top_price > (target_price + 0.05):
                        # 1. 买盘大单扫货
                        status = "FILLED"
                        status_label = "已完全成交 (买盘扫货吞并)"
                        fill_mode = "dumper"
                        fill_mode_label = "买盘巨量扫货穿透"
                        estimated_filled = initial_qty
                        fill_pct = 100.0
                        needs_alert = (prev_filled or 0) < initial_qty
                        alert_type = "filled"
                        alert_msg = f"{clean_item_display_name(item_id)} 遭遇买盘大额扫货穿透，已 100% 全部成交！"
                    elif prev_rank == 1:
                        # 2. 队首自然撮合
                        status = "FILLED"
                        status_label = "已完全成交 (队首自然撮合)"
                        fill_mode = "retail"
                        fill_mode_label = "队首买家撮合完毕"
                        estimated_filled = initial_qty
                        fill_pct = 100.0
                        needs_alert = (prev_filled or 0) < initial_qty
                        alert_type = "filled"
                        alert_msg = f"{clean_item_display_name(item_id)} 出售挂单在队首完成撮合，100% 完全成交！"
                    elif book_depth >= 25 and lowest_or_highest_in_book < (target_price - 0.05):
                        # 3. 深度压盘脱离
                        status = "OUTBID_DEEP"
                        status_label = "深度脱离盘口 (被压在30档外)"
                        fill_mode = "none"
                        fill_mode_label = "已被更低卖价压出30档外"
                        estimated_filled = prev_filled or 0
                        fill_pct = min(100.0, round(((prev_filled or 0) / initial_qty) * 100, 1)) if initial_qty > 0 else 0.0
                        needs_alert = True
                        alert_type = "outbid"
                        alert_msg = f"{clean_item_display_name(item_id)} 出售挂单已被更低报价压出前30档深度，请及时调价！"
                    else:
                        # 4. 非榜一脱离 -> 主动撤单
                        status = "CANCELLED"
                        status_label = "挂单已撤销 (非队首脱离)"
                        fill_mode = "cancelled"
                        fill_mode_label = "非队首脱离，判定为已主动撤单"
                        estimated_filled = prev_filled or 0
                        fill_pct = min(100.0, round(((prev_filled or 0) / initial_qty) * 100, 1)) if initial_qty > 0 else 0.0
                        needs_alert = True
                        alert_type = "cancelled"
                        alert_msg = f"{clean_item_display_name(item_id)} 出售单在第 #{prev_rank or '?'} 顺位脱离盘口 (前方低价单仍在)，判定为已主动撤单。"
                
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
                    "fill_mode": fill_mode,
                    "fill_mode_label": fill_mode_label,
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
