"""
Price History & Anomaly Detection Engine:
Tracks rolling price & volume metrics for SkyBlock gemstones.
Detects flash crashes, liquidity vacuums, and extreme arbitrage opportunities (e.g., Aquamarine Flawed dumping below 1 coin).
"""

import os
import json
import time
from typing import Dict, Any, List, Optional
import numpy as np

from backend.flipper_engine import extract_product_pricing

HISTORY_FILE = "gem_history.json"
MAX_HISTORY_SNAPSHOTS = 120  # Keep ~120 rolling snapshots (~2-4 days depending on poll rate)
MIN_SNAPSHOT_INTERVAL_SEC = 45  # Throttle snapshots to at least 45 seconds apart

class PriceTracker:
    def __init__(self, history_file: str = HISTORY_FILE):
        self.history_file = history_file
        self.history: List[Dict[str, Any]] = []
        self._last_snapshot_ts: float = 0
        self._load_history()

    def _load_history(self) -> None:
        """Loads historical price snapshots from disk."""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        self.history = data[-MAX_HISTORY_SNAPSHOTS:]
                        if self.history:
                            self._last_snapshot_ts = self.history[-1].get("timestamp", 0)
            except Exception as e:
                print(f"[PriceTracker] [WARN] 读取历史时序数据失败: {e}")
                self.history = []

    def _save_history(self) -> None:
        """Persists history to disk safely."""
        try:
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump(self.history, f, ensure_ascii=False)
        except Exception as e:
            print(f"[PriceTracker] [WARN] 写入历史时序数据失败: {e}")

    def record_snapshot(self, products: Dict[str, Any]) -> None:
        """
        Records a timestamped snapshot of gemstone prices and volumes.
        Throttled to avoid unnecessary write overhead.
        """
        now = time.time()
        if (now - self._last_snapshot_ts) < MIN_SNAPSHOT_INTERVAL_SEC:
            return

        snapshot_items = {}
        for product_id, p_data in products.items():
            if "_GEM" in product_id or product_id in ["PRECURSOR_APPARATUS", "JUNGLE_KEY"]:
                pricing = extract_product_pricing(p_data)
                qs = p_data.get("quick_status", {})
                buy_vol = int(qs.get("buyVolume", 0) or 0)
                sell_vol = int(qs.get("sellVolume", 0) or 0)
                moving_week_buy = int(qs.get("buyMovingWeek", 0) or 0)
                moving_week_sell = int(qs.get("sellMovingWeek", 0) or 0)

                snapshot_items[product_id] = {
                    "ib": pricing["ib_price"],
                    "bo": pricing["bo_price"],
                    "has_bo": pricing["has_buy_order"],
                    "has_ib": pricing["has_sell_offer"],
                    "bv": buy_vol,
                    "sv": sell_vol,
                    "mw": moving_week_buy + moving_week_sell
                }

        if snapshot_items:
            self.history.append({
                "timestamp": int(now),
                "items": snapshot_items
            })
            if len(self.history) > MAX_HISTORY_SNAPSHOTS:
                self.history = self.history[-MAX_HISTORY_SNAPSHOTS:]
            self._last_snapshot_ts = now
            self._save_history()

    def get_item_trend(self, item_id: str, current_bo: float, current_ib: float) -> Dict[str, Any]:
        """
        Calculates 24h min, max, avg, price change %, and trend classification for a given item.
        """
        prices_bo = []
        for snap in self.history:
            items = snap.get("items", {})
            if item_id in items:
                bo = items[item_id].get("bo", 0)
                if bo > 0:
                    prices_bo.append(bo)

        # Include current price
        if current_bo > 0:
            prices_bo.append(current_bo)

        if not prices_bo:
            return {
                "min_24h": current_bo,
                "max_24h": current_bo,
                "avg_24h": current_bo,
                "change_pct": 0.0,
                "trend_code": "STABLE",
                "trend_label": "平稳",
                "trend_icon": "fa-minus text-slate-400"
            }

        min_p = min(prices_bo)
        max_p = max(prices_bo)
        avg_p = float(np.mean(prices_bo))
        
        # Reference baseline: compare to avg or early snapshot
        ref_price = avg_p if avg_p > 0 else current_bo
        change_pct = ((current_bo - ref_price) / ref_price * 100.0) if ref_price > 0 else 0.0

        # Classify trend
        if change_pct <= -40.0:
            code = "FLASH_CRASH"
            label = f"暴跌抛售 ({change_pct:+.1f}%)"
            icon = "fa-arrow-trend-down text-rose-500 font-bold"
        elif change_pct <= -10.0:
            code = "DOWN"
            label = f"承压下行 ({change_pct:+.1f}%)"
            icon = "fa-arrow-down text-amber-400"
        elif change_pct >= 40.0:
            code = "SPIKE"
            label = f"短线暴涨 ({change_pct:+.1f}%)"
            icon = "fa-arrow-trend-up text-cyan-400 font-bold"
        elif change_pct >= 10.0:
            code = "UP"
            label = f"企稳回升 ({change_pct:+.1f}%)"
            icon = "fa-arrow-up text-emerald-400"
        else:
            code = "STABLE"
            label = "价格平稳"
            icon = "fa-minus text-slate-400"

        return {
            "min_24h": round(min_p, 1),
            "max_24h": round(max_p, 1),
            "avg_24h": round(avg_p, 1),
            "change_pct": round(change_pct, 1),
            "trend_code": code,
            "trend_label": label,
            "trend_icon": icon
        }

    def detect_anomalies(self, flipper_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Scans calculated flips and identifies quantified market anomalies:
        - Tier 1: Extreme NPC Arbitrage / Breakout (< 1 coin or < NPC price)
        - Tier 2: Liquidity Vacuum / Order Book Gap (Instant Buy / Buy Order > 5x or zero buy orders)
        - Tier 3: Flash Crash (> 50% drop)
        """
        anomalies = []

        for item in flipper_results:
            item_id = item.get("item_id", "")
            gem_key = item.get("gem", "")
            gem_cn = item.get("name_cn", gem_key)
            gem_en = item.get("gem_name", gem_key.capitalize())
            tier = item.get("tier", "")
            tier_cn = item.get("tier_cn", tier)
            tier_en = tier.capitalize()
            gem_en_formatted = f"{gem_en} ({tier_en})"

            bo_price = item.get("sell_price", 0.0)  # Buy Order price
            ib_price = item.get("buy_price", 0.0)   # Instant Buy price
            npc_price = item.get("npc_price")
            buy_vol = item.get("buy_volume", 0)
            trend = item.get("trend", {})
            change_pct = trend.get("change_pct", 0.0)

            # -------------------------------------------------------------
            # ANOMALY 0: Order-Book Shortage / Vacuum (No Order or No Offer)
            # -------------------------------------------------------------
            order_anomaly = item.get("order_anomaly")
            if order_anomaly == "NO_ORDER":
                anomalies.append({
                    "item_id": item_id,
                    "gem": gem_key,
                    "gem_cn": gem_cn,
                    "gem_name": gem_en,
                    "gem_en_formatted": gem_en_formatted,
                    "tier": tier,
                    "tier_cn": tier_cn,
                    "tier_level": 2,
                    "severity": "WARNING",
                    "title": f"⚠️ [盘口断求] {gem_en_formatted} 暂无买单 (No Order)",
                    "description": f"当前 Bazaar 市场中该道具暂无人挂买单求购 (sell_summary 为空)，买盘出现真空断档。",
                    "action_advice": "当前无买单托底，若秒卖将无法成交或成交极低；可尝试低价挂买单捡漏！",
                    "bazaar_price": 0.0,
                    "npc_price": npc_price,
                    "color": item.get("color", "#f59e0b")
                })
                continue
            elif order_anomaly == "NO_OFFER":
                anomalies.append({
                    "item_id": item_id,
                    "gem": gem_key,
                    "gem_cn": gem_cn,
                    "gem_name": gem_en,
                    "gem_en_formatted": gem_en_formatted,
                    "tier": tier,
                    "tier_cn": tier_cn,
                    "tier_level": 2,
                    "severity": "WARNING",
                    "title": f"📦 [现货断供] {gem_en_formatted} 现货断供 (No Offer)",
                    "description": f"当前 Bazaar 市场中该道具暂无任何在售现货 (buy_summary 为空)，无法即时秒买。",
                    "action_advice": "现货处于完全断供状态，可通过挂买单或锻造自产，抢占现货断供定价权！",
                    "bazaar_price": bo_price,
                    "npc_price": npc_price,
                    "color": item.get("color", "#f59e0b")
                })
                continue
            elif order_anomaly == "LIQUIDITY_VACUUM":
                anomalies.append({
                    "item_id": item_id,
                    "gem": gem_key,
                    "gem_cn": gem_cn,
                    "gem_name": gem_en,
                    "gem_en_formatted": gem_en_formatted,
                    "tier": tier,
                    "tier_cn": tier_cn,
                    "tier_level": 2,
                    "severity": "HIGH",
                    "title": f"🚨 [流动性枯竭] {gem_en_formatted} 盘口双向真空 (No Order & No Offer)",
                    "description": f"当前在 Bazaar 市场中既无买单亦无卖单现货，流动性完全枯竭。",
                    "action_advice": "市场处于冷门空窗期，谨慎交易谨防资产锁定！",
                    "bazaar_price": 0.0,
                    "npc_price": npc_price,
                    "color": item.get("color", "#f59e0b")
                })
                continue

            # -------------------------------------------------------------
            # ANOMALY 1: NPC Price Breakout / Arbitrage (Tier 1)
            # E.g. Aquamarine Flawed dumping below 1 coin vs 320 coin NPC price!
            # -------------------------------------------------------------
            if npc_price is not None and npc_price > 0 and bo_price > 0 and bo_price < npc_price:
                profit_per_unit = npc_price - bo_price
                arbitrage_roi = (profit_per_unit / bo_price) * 100.0

                is_critical = (bo_price <= 0.5 * npc_price) or (bo_price <= 5.0)

                severity = "CRITICAL" if is_critical else "HIGH"
                tier_level = 1
                
                title = f"🚨 [跌破保底价/白送套利] {gem_en_formatted} 跌破 NPC 保底收购价！" if is_critical else f"⚡ [低于保底价套利] {gem_en_formatted} 低于 NPC 保底价"
                desc = (
                    f"当前预购价仅 {bo_price:.1f} Coins，远低于 NPC 保底收购价 ({npc_price} Coins)！"
                    f"直接买入转售 NPC 即可获得 +{arbitrage_roi:,.1f}% 确定性无风险收益！"
                )
                action = f"全力挂单预购，或直售 NPC 赚取每颗 {profit_per_unit:.1f} Coins 确定性利润！"

                anomalies.append({
                    "item_id": item_id,
                    "gem": gem_key,
                    "gem_cn": gem_cn,
                    "gem_name": gem_en,
                    "gem_en_formatted": gem_en_formatted,
                    "tier": tier,
                    "tier_cn": tier_cn,
                    "tier_level": tier_level,
                    "severity": severity,
                    "title": title,
                    "description": desc,
                    "action_advice": action,
                    "bazaar_price": bo_price,
                    "npc_price": npc_price,
                    "arbitrage_roi_pct": round(arbitrage_roi, 1),
                    "profit_per_unit": round(profit_per_unit, 1),
                    "color": item.get("color", "#f59e0b")
                })
                continue

            # -------------------------------------------------------------
            # ANOMALY 2: Liquidity Vacuum / Order Book Gap (Tier 2)
            # Instant Buy vs Buy Order spread ratio > 5.0x, or buy order vacuum
            # -------------------------------------------------------------
            if bo_price > 0 and ib_price > 0:
                spread_ratio = ib_price / bo_price
                if (spread_ratio >= 5.0 and bo_price < 200.0) or (buy_vol < 1000 and tier in ["FLAWED", "FINE"]):
                    anomalies.append({
                        "item_id": item_id,
                        "gem": gem_key,
                        "gem_cn": gem_cn,
                        "gem_name": gem_en,
                        "gem_en_formatted": gem_en_formatted,
                        "tier": tier,
                        "tier_cn": tier_cn,
                        "tier_level": 2,
                        "severity": "WARNING",
                        "title": f"⚠️ [流动性断层] {gem_en_formatted} 盘口出现断层",
                        "description": f"买卖价差比高达 {spread_ratio:.1f}x (现货 {ib_price:,.1f} vs 预购 {bo_price:.1f})，买单被瞬间砸穿出现空窗。",
                        "action_advice": "可低价挂买单尝试捡漏，但切忌使用秒卖变现，谨防踩入无人求购陷阱！",
                        "bazaar_price": bo_price,
                        "npc_price": npc_price,
                        "spread_ratio": round(spread_ratio, 1),
                        "color": item.get("color", "#f59e0b")
                    })
                    continue

            # -------------------------------------------------------------
            # ANOMALY 3: Short-term Flash Dump (Tier 3)
            # 24h drop > 50%
            # -------------------------------------------------------------
            if change_pct <= -50.0 and bo_price > 0:
                anomalies.append({
                    "item_id": item_id,
                    "gem": gem_key,
                    "gem_cn": gem_cn,
                    "gem_name": gem_en,
                    "gem_en_formatted": gem_en_formatted,
                    "tier": tier,
                    "tier_cn": tier_cn,
                    "tier_level": 3,
                    "severity": "CAUTION",
                    "title": f"📉 [短线大幅下挫] {gem_en_formatted} 跳水 {change_pct:.1f}%",
                    "description": f"当前价 {bo_price:.1f} Coins 较近期均价剧烈下跌 {abs(change_pct):.1f}%，遭遇采矿节/冰洞巨量抛盘冲击。",
                    "action_advice": "密切关注探底企稳信号，待采矿节退潮后有较强回弹预期。",
                    "bazaar_price": bo_price,
                    "npc_price": npc_price,
                    "change_pct": change_pct,
                    "color": item.get("color", "#f59e0b")
                })

        # Sort anomalies by severity: CRITICAL first, then HIGH, WARNING, CAUTION
        severity_order = {"CRITICAL": 0, "HIGH": 1, "WARNING": 2, "CAUTION": 3}
        anomalies.sort(key=lambda x: severity_order.get(x["severity"], 99))
        return anomalies
