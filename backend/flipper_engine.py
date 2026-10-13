"""
Gemstone Flipper Engine & Constants (Updated with Community Wiki & Player Field Operations)
Contains all game formulas, gemstone data, NPC prices, crystal difficulty, and calculation routines.
"""

from typing import Dict, List, Optional, Any
import numpy as np

# 12 Gemstones metadata
# Note: Flawless and Perfect gemstones CANNOT be sold to NPCs in Hypixel SkyBlock.
GEMSTONE_METADATA = {
    "AMBER": {
        "name": "Amber",
        "name_cn": "琥珀",
        "stat": "Mining Speed",
        "icon": "⸕",
        "color": "#f59e0b",
        "cn": 5,
        "cn_desc": "Goblin Queen's Den (持King's Scent直接采/免费/无限刷)",
        "crystal_item": None,
        "is_glacite": False,
        "npc_rough": 3,
        "npc_flawed": 240,
        "npc_fine": 19200,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "TOPAZ": {
        "name": "Topaz",
        "name_cn": "黄玉",
        "stat": "Pristine",
        "icon": "✧",
        "color": "#fbbf24",
        "cn": 5,
        "cn_desc": "Magma Barrage / Khazad-dûm (击杀怪/放水晶/无限刷)",
        "crystal_item": None,
        "is_glacite": False,
        "npc_rough": 3,
        "npc_flawed": 240,
        "npc_fine": 19200,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "SAPPHIRE": {
        "name": "Sapphire",
        "name_cn": "蓝宝石",
        "stat": "Intelligence",
        "icon": "✎",
        "color": "#38bdf8",
        "cn": 3,
        "cn_desc": "Precursor City (需1台Precursor Apparatus兑换/约1M成本)",
        "crystal_item": "PRECURSOR_APPARATUS",
        "is_glacite": False,
        "npc_rough": 3,
        "npc_flawed": 240,
        "npc_fine": 19200,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "AMETHYST": {
        "name": "Amethyst",
        "name_cn": "紫水晶",
        "stat": "Defense",
        "icon": "❈",
        "color": "#a855f7",
        "cn": 2,
        "cn_desc": "Jungle Temple (需Jungle Key钥匙/绊线跑酷解密)",
        "crystal_item": "JUNGLE_KEY",
        "is_glacite": False,
        "npc_rough": 3,
        "npc_flawed": 240,
        "npc_fine": 19200,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "JADE": {
        "name": "Jade",
        "name_cn": "翡翠",
        "stat": "Mining Fortune",
        "icon": "☘",
        "color": "#22c55e",
        "cn": 2,
        "cn_desc": "Mines of Divan (搜寻4件失落矿工工具/解密探索)",
        "crystal_item": None,
        "is_glacite": False,
        "npc_rough": 3,
        "npc_flawed": 240,
        "npc_fine": 19200,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "JASPER": {
        "name": "Jasper",
        "name_cn": "碧玉",
        "stat": "Strength",
        "icon": "❁",
        "color": "#f43f5e",
        "cn": 1,
        "cn_desc": "Nucleus Run 跑水晶偶得 / 冰川矿井(Mineshaft)开箱掉落",
        "crystal_item": None,
        "is_glacite": True,
        "npc_rough": 4,
        "npc_flawed": 320,
        "npc_fine": 25600,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "RUBY": {
        "name": "Ruby",
        "name_cn": "红宝石",
        "stat": "Health",
        "icon": "❤",
        "color": "#ef4444",
        "cn": 1,
        "cn_desc": "Nucleus Run 跑水晶偶得 / 冰川矿井(Mineshaft)开箱掉落",
        "crystal_item": None,
        "is_glacite": False,
        "npc_rough": 3,
        "npc_flawed": 240,
        "npc_fine": 19200,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "ONYX": {
        "name": "Onyx",
        "name_cn": "缟玛瑙",
        "stat": "Crit Damage",
        "icon": "☠",
        "color": "#64748b",
        "cn": 0,
        "cn_desc": "仅在冰川隧道矿井(Glacite Mineshaft)尸体与箱子偶得",
        "crystal_item": None,
        "is_glacite": True,
        "npc_rough": 4,
        "npc_flawed": 320,
        "npc_fine": 25600,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "CITRINE": {
        "name": "Citrine",
        "name_cn": "黄水晶",
        "stat": "Foraging Fortune",
        "icon": "☘",
        "color": "#ea580c",
        "cn": 0,
        "cn_desc": "仅在冰川隧道矿井(Glacite Mineshaft)尸体与箱子偶得",
        "crystal_item": None,
        "is_glacite": True,
        "npc_rough": 4,
        "npc_flawed": 320,
        "npc_fine": 25600,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "PERIDOT": {
        "name": "Peridot",
        "name_cn": "橄榄石",
        "stat": "Farming Fortune",
        "icon": "☘",
        "color": "#84cc16",
        "cn": 0,
        "cn_desc": "仅在冰川隧道矿井(Glacite Mineshaft)尸体与箱子偶得",
        "crystal_item": None,
        "is_glacite": True,
        "npc_rough": 4,
        "npc_flawed": 320,
        "npc_fine": 25600,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "AQUAMARINE": {
        "name": "Aquamarine",
        "name_cn": "海蓝宝石",
        "stat": "Fishing Speed",
        "icon": "☂",
        "color": "#06b6d4",
        "cn": 0,
        "cn_desc": "仅在冰川隧道矿井(Glacite Mineshaft)尸体与箱子偶得",
        "crystal_item": None,
        "is_glacite": True,
        "npc_rough": 4,
        "npc_flawed": 320,
        "npc_fine": 25600,
        "npc_flawless": None,
        "npc_perfect": None
    },
    "OPAL": {
        "name": "Opal",
        "name_cn": "蛋白石",
        "stat": "True Defense",
        "icon": "❂",
        "color": "#e2e8f0",
        "cn": -1,
        "cn_desc": "冰川矿井偶得 / 非GT任务刚需 / 市场流通需求相对偏低",
        "crystal_item": None,
        "is_glacite": False,
        "npc_rough": 3,
        "npc_flawed": 240,
        "npc_fine": 19200,
        "npc_flawless": None,
        "npc_perfect": None
    }
}

# Tiers configuration: strictly 80-to-1 progression
# 80 Rough = 1 Flawed
# 80 Flawed = 1 Fine
# 80 Fine = 1 Flawless
# 5 Flawless + 1 Crystal = 1 Perfect
TIER_AMT_BASE = {
    "ROUGH": 512000,   # 80 * 80 * 80 per Flawless (2,560,000 per Perfect)
    "FLAWED": 6400,    # 80 * 80 per Flawless (32,000 per Perfect)
    "FINE": 80,        # 80 per Flawless (400 per Perfect)
    "FLAWLESS": 1      # 1 per Flawless (5 per Perfect)
}

# Standardized Quality Translations & Metadata
TIER_TRANSLATIONS = {
    "ROUGH": {"en": "Rough", "cn": "粗糙", "desc": "粗糙 (Common 灰白)"},
    "FLAWED": {"en": "Flawed", "cn": "微瑕", "desc": "微瑕 (Uncommon 绿) [推荐]"},
    "FINE": {"en": "Fine", "cn": "精致", "desc": "精致 (Rare 蓝) [快速]"},
    "FLAWLESS": {"en": "Flawless", "cn": "无瑕", "desc": "无瑕 (Epic 紫) [免合成]"},
    "PERFECT": {"en": "★Perfect", "cn": "★完美", "desc": "★完美 (Legendary 金)"}
}

# Standardized CN Complexity / Crystal Acquisition Grade Map
CN_GRADE_MAP = {
    5: {"grade": "S级", "label": "S级: 速刷", "desc": "极易反复刷取水晶，市场货源充足"},
    3: {"grade": "A级", "label": "A级: 蓝宝石", "desc": "先驱者装置兑换 (~1M 门槛/核心产物)"},
    2: {"grade": "B级", "label": "B级: 慢刷", "desc": "丛林神庙/走迷宫/采蛋，单次获取较为繁杂"},
    1: {"grade": "C级", "label": "C级: 限跑水晶/冰洞偶得", "desc": "跑水晶核探险或冰洞奇遇偶得"},
    0: {"grade": "GTMS only", "label": "GTMS only: 仅限冰洞偶得", "desc": "仅冰川矿井 (Glacite Mineshafts) 稀有产出"},
    -1: {"grade": "OPAL", "label": "OPAL: 蛋白石", "desc": "非主流锻造刚需，流通需求偏低"}
}

# Bazaar single order limit: 71,680 items
BAZAAR_ORDER_LIMIT = 71680

# Base forge duration for Perfect Gemstones: 20 hours (from Dwarven Forge)
BASE_FORGE_HOURS = 20.0

def extract_product_pricing(product_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extracts real-time order-book pricing from Hypixel Bazaar product data:
    - sell_summary: Sorted list of active Buy Orders (bids). 
                    sell_summary[0]['pricePerUnit'] = Top Buy Order price (BO / 预购买入价).
                    If empty, indicates 断求 (NO_ORDER).
    - buy_summary:  Sorted list of active Sell Offers (asks).
                    buy_summary[0]['pricePerUnit'] = Top Sell Offer / Instant Buy price (IB / 秒买现货价 / 挂单竞争价).
                    If empty, indicates 断供 (NO_OFFER).
    - Fallback:     If neither summary exists (e.g. offline gemflipper.xlsx snapshot),
                    gracefully fall back to quick_status without false anomaly alarms.
    """
    if not product_data:
        return {
            "bo_price": 0.0,
            "ib_price": 0.0,
            "has_buy_order": False,
            "has_sell_offer": False,
            "order_anomaly": "NO_ORDER",
            "is_from_orderbook": False
        }
    
    sell_summary = product_data.get("sell_summary")
    buy_summary = product_data.get("buy_summary")
    qs = product_data.get("quick_status", {})

    has_live_summaries = isinstance(sell_summary, list) or isinstance(buy_summary, list)

    if has_live_summaries:
        sell_sum_list = sell_summary if isinstance(sell_summary, list) else []
        buy_sum_list = buy_summary if isinstance(buy_summary, list) else []

        has_bo = len(sell_sum_list) > 0
        has_ib = len(buy_sum_list) > 0

        bo_price = float(sell_sum_list[0].get("pricePerUnit", 0.0)) if has_bo else 0.0
        ib_price = float(buy_sum_list[0].get("pricePerUnit", 0.0)) if has_ib else 0.0

        if not has_bo and not has_ib:
            anomaly = "LIQUIDITY_VACUUM"
        elif not has_bo:
            anomaly = "NO_ORDER"
        elif not has_ib:
            anomaly = "NO_OFFER"
        else:
            anomaly = None

        return {
            "bo_price": bo_price,
            "ib_price": ib_price,
            "has_buy_order": has_bo,
            "has_sell_offer": has_ib,
            "order_anomaly": anomaly,
            "is_from_orderbook": True
        }
    else:
        # Fallback to quick_status (offline Excel snapshot)
        bo_price = float(qs.get("sellPrice", 0) or 0)
        ib_price = float(qs.get("buyPrice", 0) or 0)
        return {
            "bo_price": bo_price,
            "ib_price": ib_price,
            "has_buy_order": bo_price > 0,
            "has_sell_offer": ib_price > 0,
            "order_anomaly": None,
            "is_from_orderbook": False
        }

def calculate_forge_duration(
    quick_forge_level: int = 20,
    cole_active: bool = False
) -> Dict[str, Any]:
    """
    Calculate forge duration with Quick Forge and Mayor Cole perk.
    - Quick Forge: 0 to 20 levels. Max gives 30% reduction (1.5% per level).
    - Cole Molten Forge: 25% reduction.
    They stack multiplicatively: Base * (1 - QF) * (1 - Cole).
    """
    qf_level = max(0, min(20, quick_forge_level))
    qf_discount = (qf_level * 1.5) / 100.0  # e.g. 0.30 at level 20
    cole_discount = 0.25 if cole_active else 0.0
    
    effective_factor = (1.0 - qf_discount) * (1.0 - cole_discount)
    total_hours = BASE_FORGE_HOURS * effective_factor
    total_seconds = total_hours * 3600
    
    hours_int = int(total_hours)
    minutes_int = int(round((total_hours - hours_int) * 60))
    if minutes_int == 60:
        hours_int += 1
        minutes_int = 0
        
    reduction_pct = (1.0 - effective_factor) * 100.0
    
    return {
        "base_hours": BASE_FORGE_HOURS,
        "total_hours": round(total_hours, 2),
        "total_seconds": int(total_seconds),
        "formatted_duration": f"{hours_int}h {minutes_int}m",
        "quick_forge_level": qf_level,
        "quick_forge_discount_pct": round(qf_discount * 100, 1),
        "cole_active": cole_active,
        "cole_discount_pct": 25.0 if cole_active else 0.0,
        "total_reduction_pct": round(reduction_pct, 1)
    }

def calculate_gem_flipper(
    bazaar_products: Dict[str, Any],
    forges: int = 1,
    quick_forge_level: int = 20,
    cole_active: bool = False,
    tax_rate: float = 0.01,
    crystal_filter: Optional[int] = None,
    tier_filter: Optional[str] = None,
    price_tracker: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Calculate full flipping profits for all 12 gemstones and input tiers.
    Sourcing: Buy Order (standard/lowest cost) or Instant Buy (fast delivery).
    Selling: Sell Offer (primary revenue goal) or Instant Sell (panic dump reference).
    """
    forges = max(1, min(7, forges))
    duration_info = calculate_forge_duration(quick_forge_level, cole_active)
    forge_hours = duration_info["total_hours"]
    
    # 1. Resolve Extra items costs for crystals
    precursor_p = bazaar_products.get("PRECURSOR_APPARATUS", {})
    precursor_pricing = extract_product_pricing(precursor_p)
    precursor_cost = precursor_pricing["bo_price"] if precursor_pricing["has_buy_order"] else precursor_pricing["ib_price"]
    
    jungle_key_p = bazaar_products.get("JUNGLE_KEY", {})
    jungle_key_pricing = extract_product_pricing(jungle_key_p)
    jungle_key_cost = jungle_key_pricing["bo_price"] if jungle_key_pricing["has_buy_order"] else jungle_key_pricing["ib_price"]
    
    crystal_costs = {
        "SAPPHIRE": precursor_cost,
        "AMETHYST": jungle_key_cost
    }
    
    results = []
    parallel_by_gem = {}
    arbitrage_items = []
    
    for gem_key, meta in GEMSTONE_METADATA.items():
        cn = meta["cn"]
        if crystal_filter is not None and cn < crystal_filter:
            continue
            
        c_cost_single = crystal_costs.get(gem_key, 0.0)
        c_cost_total = c_cost_single * forges
        
        # Perfect gemstone real-time prices from order-book
        perfect_id = f"PERFECT_{gem_key}_GEM"
        perfect_p = bazaar_products.get(perfect_id, {})
        perfect_pricing = extract_product_pricing(perfect_p)
        perfect_offer_unit = perfect_pricing["ib_price"]   # Sell offer listing price (top ask in buy_summary)
        perfect_sell_unit = perfect_pricing["bo_price"]    # Instant sell price (top bid in sell_summary)
        perfect_has_offer = perfect_pricing["has_sell_offer"]
        perfect_has_order = perfect_pricing["has_buy_order"]
        perfect_anomaly = perfect_pricing["order_anomaly"]
        
        # Perfect revenue after tax
        perfect_offer_gross = perfect_offer_unit * forges
        perfect_offer_net = perfect_offer_gross * (1.0 - tax_rate)
        perfect_sell_gross = perfect_sell_unit * forges
        perfect_sell_net = perfect_sell_gross  # Instant sell has no extra listing tax
        
        tier_list = ["FLAWED", "FINE", "FLAWLESS", "ROUGH"]
        if tier_filter and tier_filter in tier_list:
            active_tiers = [tier_filter]
        else:
            active_tiers = tier_list
            
        parallel_by_gem[gem_key] = []
        
        for tier in active_tiers:
            item_id = f"{tier}_{gem_key}_GEM"
            p_data = bazaar_products.get(item_id, {})
            item_pricing = extract_product_pricing(p_data)
            qs = p_data.get("quick_status", {})
            
            sell_price_unit = item_pricing["bo_price"]  # Buy order price (from sell_summary[0])
            buy_price_unit = item_pricing["ib_price"]   # Instant buy price (from buy_summary[0])
            has_buy_order = item_pricing["has_buy_order"]
            has_sell_offer = item_pricing["has_sell_offer"]
            order_anomaly = item_pricing["order_anomaly"]
            
            buy_volume = int(qs.get("buyVolume", 0) or 0)
            sell_volume = int(qs.get("sellVolume", 0) or 0)
            buy_moving_week = int(qs.get("buyMovingWeek", 0) or 0)
            sell_moving_week = int(qs.get("sellMovingWeek", 0) or 0)
            
            amt_base = TIER_AMT_BASE[tier]
            units_per_forge = 5 * amt_base
            total_units_needed = units_per_forge * forges
            
            # Number of Bazaar orders needed (max 71,680 per order)
            orders_needed = round(total_units_needed / BAZAAR_ORDER_LIMIT, 2)
            
            # Check NPC price for this tier (Only Rough, Flawed, Fine can be sold to NPC)
            npc_key = f"npc_{tier.lower()}"
            npc_price = meta.get(npc_key)  # will be None for Flawless/Perfect
            
            # Arbitrage detection: if bazaar price is lower than NPC price
            if npc_price is not None and npc_price > 0:
                if has_buy_order and sell_price_unit > 0 and sell_price_unit < npc_price:
                    arbitrage_items.append({
                        "item_id": item_id,
                        "gem": gem_key,
                        "tier": tier,
                        "bazaar_price": sell_price_unit,
                        "npc_price": npc_price,
                        "profit_per_unit": npc_price - sell_price_unit,
                        "type": "BUY_ORDER_BELOW_NPC"
                    })
                if has_sell_offer and buy_price_unit > 0 and buy_price_unit < npc_price:
                    arbitrage_items.append({
                        "item_id": item_id,
                        "gem": gem_key,
                        "tier": tier,
                        "bazaar_price": buy_price_unit,
                        "npc_price": npc_price,
                        "profit_per_unit": npc_price - buy_price_unit,
                        "type": "INSTA_BUY_BELOW_NPC"
                    })
                
            # Cost calculations
            # costBuyOrder: Buy Order gems + Crystal cost (Primary / lowest cost)
            cost_buy_order = (sell_price_unit * total_units_needed) + c_cost_total if has_buy_order else 0.0
            # costInstaBuy: Instant Buy gems + Crystal cost (Fast delivery)
            cost_insta_buy = (buy_price_unit * total_units_needed) + c_cost_total if has_sell_offer else 0.0
            delta_cost = (cost_insta_buy - cost_buy_order) if (has_buy_order and has_sell_offer) else 0.0
            
            # 4 Profit scenarios:
            # 1. MAXProfit: Buy Order -> Sell Offer (Standard optimal flipping)
            max_profit = (perfect_offer_net - cost_buy_order) if (has_buy_order and perfect_has_offer) else 0.0
            # 2. Profit2 (Fast In): Instant Buy -> Sell Offer (Fast sourcing, sell order)
            profit_offer_ib = (perfect_offer_net - cost_insta_buy) if (has_sell_offer and perfect_has_offer) else 0.0
            # 3. Profit3 (Panic Out): Buy Order -> Instant Sell (Liquidate fast during price crash)
            profit_is_order = (perfect_sell_net - cost_buy_order) if (has_buy_order and perfect_has_order) else 0.0
            # 4. MINProfit (Worst Case): Instant Buy -> Instant Sell
            min_profit = (perfect_sell_net - cost_insta_buy) if (has_sell_offer and perfect_has_order) else 0.0
            
            # Standard Deviation of profit across 4 scenarios
            profits_arr = [p for p in [max_profit, profit_offer_ib, profit_is_order, min_profit] if p != 0]
            std_dev = float(np.std(profits_arr)) if len(profits_arr) >= 2 else 0.0
            
            # ROI
            roi_buy_order = (max_profit / cost_buy_order) if (cost_buy_order > 0 and has_buy_order and perfect_has_offer) else 0.0
            roi_insta_buy = (profit_offer_ib / cost_insta_buy) if (cost_insta_buy > 0 and has_sell_offer and perfect_has_offer) else 0.0
            
            # Profit per hour & day (Based on Optimal MAXProfit)
            profit_per_hour = (max_profit / forge_hours) if (forge_hours > 0 and has_buy_order and perfect_has_offer) else 0.0
            profit_per_day = profit_per_hour * 24.0
            
            # Sourcing practicality warning for Rough
            is_rough = (tier == "ROUGH")
            practical_score = 1 if not is_rough else 0
            
            weekly_volume = buy_moving_week + sell_moving_week
            daily_volume = round(weekly_volume / 7)
            hourly_volume = round(weekly_volume / 168)
            bid_depth_ratio = round(buy_volume / sell_volume, 2) if sell_volume > 0 else 1.0

            trend_info = price_tracker.get_item_trend(item_id, sell_price_unit, buy_price_unit) if price_tracker else {
                "min_24h": sell_price_unit,
                "max_24h": sell_price_unit,
                "avg_24h": sell_price_unit,
                "change_pct": 0.0,
                "trend_code": "STABLE",
                "trend_label": "平稳",
                "trend_icon": "fa-minus text-slate-400"
            }

            entry = {
                "gem": gem_key,
                "gem_name": meta["name"],
                "name_cn": meta.get("name_cn", meta["name"]),
                "stat": meta["stat"],
                "icon": meta["icon"],
                "color": meta["color"],
                "cn": cn,
                "cn_desc": meta["cn_desc"],
                "cn_grade": CN_GRADE_MAP.get(cn, {}).get("grade", f"{cn}级"),
                "cn_label": CN_GRADE_MAP.get(cn, {}).get("label", f"{cn}级"),
                "tier": tier,
                "tier_cn": TIER_TRANSLATIONS.get(tier, {}).get("cn", tier),
                "tier_en": TIER_TRANSLATIONS.get(tier, {}).get("en", tier),
                "perfect_target_name": f"★Perfect {meta['name']} Gemstone",
                "perfect_target_cn": f"★完美 {meta.get('name_cn', meta['name'])}宝石",
                "amt_base": amt_base,
                "units_per_forge": units_per_forge,
                "total_units_needed": total_units_needed,
                "orders_needed": orders_needed,
                "is_rough_warning": is_rough,
                "crystal_item": meta["crystal_item"],
                "crystal_cost_unit": c_cost_single,
                "crystal_cost_total": c_cost_total,
                "npc_price": npc_price,
                "item_id": item_id,
                # Unit prices & Order-Book Status
                "buy_price": buy_price_unit,
                "sell_price": sell_price_unit,
                "has_buy_order": has_buy_order,
                "has_sell_offer": has_sell_offer,
                "order_anomaly": order_anomaly,
                "perfect_offer_unit": perfect_offer_unit,
                "perfect_sell_unit": perfect_sell_unit,
                "perfect_has_offer": perfect_has_offer,
                "perfect_has_order": perfect_has_order,
                "perfect_anomaly": perfect_anomaly,
                # Volumes & Liquidity
                "buy_volume": buy_volume,
                "sell_volume": sell_volume,
                "buy_moving_week": buy_moving_week,
                "sell_moving_week": sell_moving_week,
                "weekly_volume": weekly_volume,
                "daily_volume": daily_volume,
                "hourly_volume": hourly_volume,
                "bid_depth_ratio": bid_depth_ratio,
                "trend": trend_info,
                "has_anomaly": False,
                "anomaly_info": None,
                # Totals
                "cost_buy_order": round(cost_buy_order, 2),
                "cost_insta_buy": round(cost_insta_buy, 2),
                "delta_cost": round(delta_cost, 2),
                "perfect_revenue_gross": round(perfect_offer_gross, 2),
                "perfect_revenue_net": round(perfect_offer_net, 2),
                "perfect_revenue_instant": round(perfect_sell_net, 2),
                # Profits
                "max_profit": round(max_profit, 2),               # BO -> Sell Offer (Main)
                "profit_fast_sourcing": round(profit_offer_ib, 2),# IB -> Sell Offer
                "profit_panic_sell": round(profit_is_order, 2),   # BO -> Instant Sell
                "min_profit": round(min_profit, 2),               # IB -> Instant Sell
                "std_dev": round(std_dev, 2),
                # Ratios
                "roi": round(roi_buy_order, 4),
                "roi_ib": round(roi_insta_buy, 4),
                # Time rates
                "profit_per_hour": round(profit_per_hour, 2),
                "profit_per_day": round(profit_per_day, 2),
                "forges": forges,
                "forge_hours": forge_hours
            }
            
            results.append(entry)
            parallel_by_gem[gem_key].append(entry)

    # Sort results by max_profit descending
    results.sort(key=lambda x: x["max_profit"], reverse=True)
    
    # Practical Candidates for Recommendations (Filter out ROUGH and items with order book shortages)
    practical_candidates = [
        r for r in results 
        if r["tier"] != "ROUGH" and r.get("has_buy_order", True) and r.get("perfect_has_offer", True)
    ]
    if not practical_candidates:
        practical_candidates = [r for r in results if r["tier"] != "ROUGH"] or results
    if not practical_candidates:
        practical_candidates = results
        
    rec_max_profit = max(practical_candidates, key=lambda x: x["max_profit"]) if practical_candidates else None
    rec_highest_roi = max(practical_candidates, key=lambda x: x["roi"]) if practical_candidates else None
    rec_fastest_hourly = max(practical_candidates, key=lambda x: x["profit_per_hour"]) if practical_candidates else None
    
    # Safest recommendation: Filter for CN >= 2 and positive min_profit, lowest std_dev
    safe_candidates = [r for r in practical_candidates if r["cn"] >= 2 and r["min_profit"] > 0]
    rec_safest = min(safe_candidates, key=lambda x: x["std_dev"]) if safe_candidates else (practical_candidates[0] if practical_candidates else None)

    # Detect Anomaly Alerts (Tier 1 Flash Arbitrage / Tier 2 Liquidity Vacuum / Tier 3 Dump)
    anomaly_alerts = []
    if price_tracker:
        anomaly_alerts = price_tracker.detect_anomalies(results)
        # Attach anomaly details back to each result item for table row rendering
        anomaly_map = {a["item_id"]: a for a in anomaly_alerts}
        for r in results:
            if r["item_id"] in anomaly_map:
                r["has_anomaly"] = True
                r["anomaly_info"] = anomaly_map[r["item_id"]]

    return {
        "config": {
            "forges": forges,
            "quick_forge_level": quick_forge_level,
            "cole_active": cole_active,
            "tax_rate": tax_rate,
            "forge_duration": duration_info
        },
        "recommendations": {
            "max_profit": rec_max_profit,
            "highest_roi": rec_highest_roi,
            "fastest_hourly": rec_fastest_hourly,
            "safest": rec_safest
        },
        "all_flips": results,
        "parallel_by_gem": parallel_by_gem,
        "arbitrage_alerts": arbitrage_items,
        "anomaly_alerts": anomaly_alerts,
        "summary": {
            "total_flips_evaluated": len(results),
            "arbitrage_opportunities": len(arbitrage_items),
            "anomaly_alerts_count": len(anomaly_alerts)
        }
    }
