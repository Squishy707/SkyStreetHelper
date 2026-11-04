"""
Crop Arbitrage Service:
Tracks Hypixel Bazaar crop market prices, calculates arbitrage profit/ROI across
various Sourcing (Buy Order, Insta-Buy, T1 Crafting for T2) and Liquidation channels
(Live NPC, Post-Nerf NPC, Bazaar Sell Offer, Bazaar Insta-Sell).
Accounts for the 500M daily NPC sell cap and the 15.00 B daily Bazaar turnover limit.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

# 15 crops across 3 tiers (T0: Standard 标准, T1: Enchanted 附魔, T2: Compacted 紧实)
CROP_DEFINITIONS = [
    # 1. CACTUS
    {
        "id": "CACTUS",
        "name": "Cactus",
        "family": "CACTUS",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 4.0,
        "npc_nerf_v1": 2.5,
        "npc_nerf_v2": 1.5,
        "npc_nerfed": 1.5,
        "icon": "🌵"
    },
    {
        "id": "ENCHANTED_CACTUS_GREEN",
        "name": "Enchanted Cactus Green",
        "family": "CACTUS",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 640.0,
        "npc_nerf_v1": 400.0,
        "npc_nerf_v2": 240.0,
        "npc_nerfed": 240.0,
        "icon": "🟢"
    },
    {
        "id": "ENCHANTED_CACTUS",
        "name": "Enchanted Cactus",
        "family": "CACTUS",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 102400.0,
        "npc_nerf_v1": 64000.0,
        "npc_nerf_v2": 38400.0,
        "npc_nerfed": 38400.0,
        "icon": "🌵"
    },
    # 2. CARROT
    {
        "id": "CARROT_ITEM",
        "name": "Carrot",
        "family": "CARROT",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 3.0,
        "npc_nerf_v1": 2.0,
        "npc_nerf_v2": 1.5,
        "npc_nerfed": 1.5,
        "icon": "🥕"
    },
    {
        "id": "ENCHANTED_CARROT",
        "name": "Enchanted Carrot",
        "family": "CARROT",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 480.0,
        "npc_nerf_v1": 320.0,
        "npc_nerf_v2": 240.0,
        "npc_nerfed": 240.0,
        "icon": "🥕"
    },
    {
        "id": "ENCHANTED_GOLDEN_CARROT",
        "name": "Enchanted Golden Carrot",
        "family": "CARROT",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 76800.0,
        "npc_nerf_v1": 51200.0,
        "npc_nerf_v2": 38400.0,
        "npc_nerfed": 38400.0,
        "icon": "🥕"
    },
    # 3. COCOA_BEANS
    {
        "id": "INK_SACK:3",
        "name": "Cocoa Beans",
        "family": "COCOA_BEANS",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 3.0,
        "npc_nerf_v1": 1.5,
        "npc_nerf_v2": 1.0,
        "npc_nerfed": 1.0,
        "icon": "🟤"
    },
    {
        "id": "ENCHANTED_COCOA",
        "name": "Enchanted Cocoa Beans",
        "family": "COCOA_BEANS",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 480.0,
        "npc_nerf_v1": 240.0,
        "npc_nerf_v2": 160.0,
        "npc_nerfed": 160.0,
        "icon": "🟤"
    },
    {
        "id": "ENCHANTED_COOKIE",
        "name": "Enchanted Cookie",
        "family": "COCOA_BEANS",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 76800.0,
        "npc_nerf_v1": 38400.0,
        "npc_nerf_v2": 25600.0,
        "npc_nerfed": 25600.0,
        "icon": "🍪"
    },
    # 4. MELON_SLICE
    {
        "id": "MELON",
        "name": "Melon Slice",
        "family": "MELON_SLICE",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 2.0,
        "npc_nerf_v1": 1.0,
        "npc_nerf_v2": 0.5,
        "npc_nerfed": 0.5,
        "icon": "🍉"
    },
    {
        "id": "ENCHANTED_MELON",
        "name": "Enchanted Melon",
        "family": "MELON_SLICE",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 320.0,
        "npc_nerf_v1": 160.0,
        "npc_nerf_v2": 80.0,
        "npc_nerfed": 80.0,
        "icon": "🍉"
    },
    {
        "id": "ENCHANTED_MELON_BLOCK",
        "name": "Enchanted Melon Block",
        "family": "MELON_SLICE",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 51200.0,
        "npc_nerf_v1": 25600.0,
        "npc_nerf_v2": 12800.0,
        "npc_nerfed": 12800.0,
        "icon": "🟩"
    },
    # 5. MOONFLOWER
    {
        "id": "MOONFLOWER",
        "name": "Moonflower",
        "family": "MOONFLOWER",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 4.0,
        "npc_nerf_v1": 3.0,
        "npc_nerf_v2": 2.0,
        "npc_nerfed": 2.0,
        "icon": "🌙"
    },
    {
        "id": "ENCHANTED_MOONFLOWER",
        "name": "Enchanted Moonflower",
        "family": "MOONFLOWER",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 640.0,
        "npc_nerf_v1": 480.0,
        "npc_nerf_v2": 320.0,
        "npc_nerfed": 320.0,
        "icon": "🌙"
    },
    {
        "id": "COMPACTED_MOONFLOWER",
        "name": "Compacted Moonflower",
        "family": "MOONFLOWER",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 102400.0,
        "npc_nerf_v1": 76800.0,
        "npc_nerf_v2": 51200.0,
        "npc_nerfed": 51200.0,
        "icon": "🌕"
    },
    # 6. RED_MUSHROOM
    {
        "id": "RED_MUSHROOM",
        "name": "Red Mushroom",
        "family": "RED_MUSHROOM",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 10.0,
        "npc_nerf_v1": 5.0,
        "npc_nerf_v2": 3.5,
        "npc_nerfed": 3.5,
        "icon": "🍄"
    },
    {
        "id": "ENCHANTED_RED_MUSHROOM",
        "name": "Enchanted Red Mushroom",
        "family": "RED_MUSHROOM",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 1600.0,
        "npc_nerf_v1": 800.0,
        "npc_nerf_v2": 560.0,
        "npc_nerfed": 560.0,
        "icon": "🍄"
    },
    {
        "id": "ENCHANTED_HUGE_MUSHROOM_2",
        "name": "Enchanted Red Mushroom Block",
        "family": "RED_MUSHROOM",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 256000.0,
        "npc_nerf_v1": 128000.0,
        "npc_nerf_v2": 89600.0,
        "npc_nerfed": 89600.0,
        "icon": "🍄"
    },
    # 7. BROWN_MUSHROOM
    {
        "id": "BROWN_MUSHROOM",
        "name": "Brown Mushroom",
        "family": "BROWN_MUSHROOM",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 10.0,
        "npc_nerf_v1": 5.0,
        "npc_nerf_v2": 3.5,
        "npc_nerfed": 3.5,
        "icon": "🤎"
    },
    {
        "id": "ENCHANTED_BROWN_MUSHROOM",
        "name": "Enchanted Brown Mushroom",
        "family": "BROWN_MUSHROOM",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 1600.0,
        "npc_nerf_v1": 800.0,
        "npc_nerf_v2": 560.0,
        "npc_nerfed": 560.0,
        "icon": "🤎"
    },
    {
        "id": "ENCHANTED_HUGE_MUSHROOM_1",
        "name": "Enchanted Brown Mushroom Block",
        "family": "BROWN_MUSHROOM",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 256000.0,
        "npc_nerf_v1": 128000.0,
        "npc_nerf_v2": 89600.0,
        "npc_nerfed": 89600.0,
        "icon": "🤎"
    },
    # 8. NETHER_WART
    {
        "id": "NETHER_STALK",
        "name": "Nether Wart",
        "family": "NETHER_WART",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 4.0,
        "npc_nerf_v1": 2.0,
        "npc_nerf_v2": 1.5,
        "npc_nerfed": 1.5,
        "icon": "🩸"
    },
    {
        "id": "ENCHANTED_NETHER_STALK",
        "name": "Enchanted Nether Wart",
        "family": "NETHER_WART",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 640.0,
        "npc_nerf_v1": 320.0,
        "npc_nerf_v2": 240.0,
        "npc_nerfed": 240.0,
        "icon": "🩸"
    },
    {
        "id": "MUTANT_NETHER_STALK",
        "name": "Mutant Nether Wart",
        "family": "NETHER_WART",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 102400.0,
        "npc_nerf_v1": 51200.0,
        "npc_nerf_v2": 38400.0,
        "npc_nerfed": 38400.0,
        "icon": "🩸"
    },
    # 9. POTATO
    {
        "id": "POTATO_ITEM",
        "name": "Potato",
        "family": "POTATO",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 3.0,
        "npc_nerf_v1": 2.0,
        "npc_nerf_v2": 1.5,
        "npc_nerfed": 1.5,
        "icon": "🥔"
    },
    {
        "id": "ENCHANTED_POTATO",
        "name": "Enchanted Potato",
        "family": "POTATO",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 480.0,
        "npc_nerf_v1": 320.0,
        "npc_nerf_v2": 240.0,
        "npc_nerfed": 240.0,
        "icon": "🥔"
    },
    {
        "id": "ENCHANTED_BAKED_POTATO",
        "name": "Enchanted Baked Potato",
        "family": "POTATO",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 76800.0,
        "npc_nerf_v1": 51200.0,
        "npc_nerf_v2": 38400.0,
        "npc_nerfed": 38400.0,
        "icon": "🥔"
    },
    # 10. PUMPKIN
    {
        "id": "PUMPKIN",
        "name": "Pumpkin",
        "family": "PUMPKIN",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 10.0,
        "npc_nerf_v1": 4.5,
        "npc_nerf_v2": 3.0,
        "npc_nerfed": 3.0,
        "icon": "🎃"
    },
    {
        "id": "ENCHANTED_PUMPKIN",
        "name": "Enchanted Pumpkin",
        "family": "PUMPKIN",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 1600.0,
        "npc_nerf_v1": 720.0,
        "npc_nerf_v2": 480.0,
        "npc_nerfed": 480.0,
        "icon": "🎃"
    },
    {
        "id": "POLISHED_PUMPKIN",
        "name": "Polished Pumpkin",
        "family": "PUMPKIN",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 256000.0,
        "npc_nerf_v1": 115200.0,
        "npc_nerf_v2": 76800.0,
        "npc_nerfed": 76800.0,
        "icon": "🎃"
    },
    # 11. SUGAR_CANE
    {
        "id": "SUGAR_CANE",
        "name": "Sugar Cane",
        "family": "SUGAR_CANE",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 4.0,
        "npc_nerf_v1": 2.5,
        "npc_nerf_v2": 1.5,
        "npc_nerfed": 1.5,
        "icon": "🎋"
    },
    {
        "id": "ENCHANTED_SUGAR",
        "name": "Enchanted Sugar",
        "family": "SUGAR_CANE",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 640.0,
        "npc_nerf_v1": 400.0,
        "npc_nerf_v2": 240.0,
        "npc_nerfed": 240.0,
        "icon": "🧂"
    },
    {
        "id": "ENCHANTED_SUGAR_CANE",
        "name": "Enchanted Sugar Cane",
        "family": "SUGAR_CANE",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 102400.0,
        "npc_nerf_v1": 64000.0,
        "npc_nerf_v2": 38400.0,
        "npc_nerfed": 38400.0,
        "icon": "🎋"
    },
    # 12. SUNFLOWER
    {
        "id": "DOUBLE_PLANT",
        "name": "Sunflower",
        "family": "SUNFLOWER",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 4.0,
        "npc_nerf_v1": 3.0,
        "npc_nerf_v2": 2.0,
        "npc_nerfed": 2.0,
        "icon": "🌻"
    },
    {
        "id": "ENCHANTED_SUNFLOWER",
        "name": "Enchanted Sunflower",
        "family": "SUNFLOWER",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 640.0,
        "npc_nerf_v1": 480.0,
        "npc_nerf_v2": 320.0,
        "npc_nerfed": 320.0,
        "icon": "🌻"
    },
    {
        "id": "COMPACTED_SUNFLOWER",
        "name": "Compacted Sunflower",
        "family": "SUNFLOWER",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 102400.0,
        "npc_nerf_v1": 76800.0,
        "npc_nerf_v2": 51200.0,
        "npc_nerfed": 51200.0,
        "icon": "🌻"
    },
    # 13. WHEAT
    {
        "id": "WHEAT",
        "name": "Wheat",
        "family": "WHEAT",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 6.0,
        "npc_nerf_v1": 2.5,
        "npc_nerf_v2": 2.5,
        "npc_nerfed": 2.5,
        "icon": "🌾"
    },
    {
        "id": "ENCHANTED_WHEAT",
        "name": "Enchanted Wheat",
        "family": "WHEAT",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 960.0,
        "npc_nerf_v1": 400.0,
        "npc_nerf_v2": 400.0,
        "npc_nerfed": 400.0,
        "icon": "🌾"
    },
    {
        "id": "ENCHANTED_HAY_BALE",
        "name": "Enchanted Hay Bale",
        "family": "WHEAT",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 153600.0,
        "npc_nerf_v1": 64000.0,
        "npc_nerf_v2": 64000.0,
        "npc_nerfed": 64000.0,
        "icon": "📦"
    },
    {
        "id": "SEEDS",
        "name": "Seeds",
        "family": "WHEAT",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 3.0,
        "npc_nerf_v1": 1.0,
        "npc_nerf_v2": 1.0,
        "npc_nerfed": 1.0,
        "icon": "🌱"
    },
    {
        "id": "ENCHANTED_SEEDS",
        "name": "Enchanted Seeds",
        "family": "WHEAT",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 480.0,
        "npc_nerf_v1": 160.0,
        "npc_nerf_v2": 160.0,
        "npc_nerfed": 160.0,
        "icon": "🌱"
    },
    {
        "id": "BOX_OF_SEEDS",
        "name": "Box of Seeds",
        "family": "WHEAT",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 76800.0,
        "npc_nerf_v1": 25600.0,
        "npc_nerf_v2": 25600.0,
        "npc_nerfed": 25600.0,
        "icon": "📦"
    },
    # 14. WILD_ROSE
    {
        "id": "WILD_ROSE",
        "name": "Wild Rose",
        "family": "WILD_ROSE",
        "tier": "T0",
        "multiplier": 1,
        "npc_live": 4.0,
        "npc_nerf_v1": 3.0,
        "npc_nerf_v2": 2.0,
        "npc_nerfed": 2.0,
        "icon": "🌹"
    },
    {
        "id": "ENCHANTED_WILD_ROSE",
        "name": "Enchanted Wild Rose",
        "family": "WILD_ROSE",
        "tier": "T1",
        "multiplier": 160,
        "npc_live": 640.0,
        "npc_nerf_v1": 480.0,
        "npc_nerf_v2": 320.0,
        "npc_nerfed": 320.0,
        "icon": "🌹"
    },
    {
        "id": "COMPACTED_WILD_ROSE",
        "name": "Compacted Wild Rose",
        "family": "WILD_ROSE",
        "tier": "T2",
        "multiplier": 25600,
        "npc_live": 102400.0,
        "npc_nerf_v1": 76800.0,
        "npc_nerf_v2": 51200.0,
        "npc_nerfed": 51200.0,
        "icon": "🌹"
    },
]

# T2 对应 T1 原料的 160:1 合成映射
T2_TO_T1_MAP = {
    "ENCHANTED_CACTUS": "ENCHANTED_CACTUS_GREEN",
    "ENCHANTED_GOLDEN_CARROT": "ENCHANTED_CARROT",
    "ENCHANTED_COOKIE": "ENCHANTED_COCOA",
    "ENCHANTED_MELON_BLOCK": "ENCHANTED_MELON",
    "COMPACTED_MOONFLOWER": "ENCHANTED_MOONFLOWER",
    "ENCHANTED_HUGE_MUSHROOM_2": "ENCHANTED_RED_MUSHROOM",
    "ENCHANTED_HUGE_MUSHROOM_1": "ENCHANTED_BROWN_MUSHROOM",
    "MUTANT_NETHER_STALK": "ENCHANTED_NETHER_STALK",
    "ENCHANTED_BAKED_POTATO": "ENCHANTED_POTATO",
    "POLISHED_PUMPKIN": "ENCHANTED_PUMPKIN",
    "ENCHANTED_SUGAR_CANE": "ENCHANTED_SUGAR",
    "COMPACTED_SUNFLOWER": "ENCHANTED_SUNFLOWER",
    "ENCHANTED_HAY_BALE": "ENCHANTED_WHEAT",
    "BOX_OF_SEEDS": "ENCHANTED_SEEDS",
    "COMPACTED_WILD_ROSE": "ENCHANTED_WILD_ROSE"
}


class CropArbitrageService:
    def __init__(self):
        self.version = "alpha 0.5.0"
        self.definitions = CROP_DEFINITIONS

    def calculate_arbitrage(self, bz_cache: Dict[str, Any]) -> Dict[str, Any]:
        """
        基于当前实时 Bazaar 盘口数据，计算全部 45 款农作物的多通道采购与退出收益指标。
        考虑 NPC 每日 500M 卖出上限以及 Bazaar 每日 15.00 B 流水额度限制。
        """
        items_result = []
        insta_buy_opps = 0
        buy_order_opps = 0
        safe_permanent_opps = 0
        max_roi_live = 0.0
        max_roi_item = None
        total_panic_weight = 0.0

        # 构建 ID 到定义项的快速索引
        def_map = {d["id"]: d for d in self.definitions}

        for item_def in self.definitions:
            pid = item_def["id"]
            live_npc = item_def["npc_live"]
            nerfed_npc = item_def["npc_nerfed"]
            mult = item_def["multiplier"]
            tier = item_def["tier"]

            bz_data = bz_cache.get(pid, {})
            qs = bz_data.get("quick_status", {})
            
            # ------------------------------------------------------------------
            # 基础市场价格 (Bazaar 盘口)
            # ------------------------------------------------------------------
            # Buy Order (挂单买入成本) = Bazaar 买单最高价 (别人瞬卖价格 sellPrice)
            buy_order_price = round(float(qs.get("sellPrice", 0.0)), 2)
            # Insta-Buy (现货秒买成本) = Bazaar 卖单最低价 (别人挂牌出售 buyPrice)
            insta_buy_price = round(float(qs.get("buyPrice", 0.0)), 2)
            # Sell Offer (挂单出售价格) = 挂单在最高买家头上 / 即对应 buyPrice
            sell_offer_price = insta_buy_price
            # Insta-Sell (现货秒卖价格) = 瞬卖给已有买单 sellPrice (不推荐)
            insta_sell_price = buy_order_price
            
            buy_volume = int(qs.get("buyVolume", 0))
            sell_volume = int(qs.get("sellVolume", 0))
            buy_orders_count = int(qs.get("buyOrders", 0))
            sell_orders_count = int(qs.get("sellOrders", 0))

            # ------------------------------------------------------------------
            # T2 作物的 T1 手动合成成本精算 (160× T1 -> 1× T2)
            # ------------------------------------------------------------------
            t1_id = None
            t1_name = None
            t1_bo_price = 0.0
            t1_ib_price = 0.0
            craft_bo_cost = 0.0
            craft_ib_cost = 0.0
            craft_bo_saving = 0.0
            craft_ib_saving = 0.0

            if tier == "T2" and pid in T2_TO_T1_MAP:
                t1_id = T2_TO_T1_MAP[pid]
                t1_def = def_map.get(t1_id, {})
                t1_name = t1_def.get("name", t1_id)
                t1_qs = bz_cache.get(t1_id, {}).get("quick_status", {})
                t1_bo_price = round(float(t1_qs.get("sellPrice", 0.0)), 2)
                t1_ib_price = round(float(t1_qs.get("buyPrice", 0.0)), 2)
                
                craft_bo_cost = round(t1_bo_price * 160, 2)
                craft_ib_cost = round(t1_ib_price * 160, 2)
                
                # 合成 vs 直接购买差价 (大于 0 代表合成更省钱)
                craft_bo_saving = round(buy_order_price - craft_bo_cost, 2) if buy_order_price > 0 else 0.0
                craft_ib_saving = round(insta_buy_price - craft_ib_cost, 2) if insta_buy_price > 0 else 0.0

            # ------------------------------------------------------------------
            # 500M NPC 每日上限与 15.00 B 集市流水精算
            # ------------------------------------------------------------------
            # 打满 500M 销售额所需件数
            cap_500m_units = round(500_000_000.0 / live_npc, 1) if live_npc > 0 else 0.0
            
            # 挂单打满 500M 的本金与纯利
            cap_cost_bo = round(cap_500m_units * buy_order_price, 2)
            cap_profit_bo = round(cap_500m_units * (live_npc - buy_order_price), 2) if buy_order_price > 0 else 0.0
            
            # 秒买打满 500M 的本金与纯利
            cap_cost_ib = round(cap_500m_units * insta_buy_price, 2)
            cap_profit_ib = round(cap_500m_units * (live_npc - insta_buy_price), 2) if insta_buy_price > 0 else 0.0

            # T1 合成打满 500M 的本金与纯利 (仅限 T2)
            cap_cost_craft_bo = round(cap_500m_units * craft_bo_cost, 2) if craft_bo_cost > 0 else 0.0
            cap_profit_craft_bo = round(cap_500m_units * (live_npc - craft_bo_cost), 2) if craft_bo_cost > 0 else 0.0

            # 集市 15.00 B (15,000,000,000) 每日流水占比
            bz_turnover_cap = 15_000_000_000.0
            bz_turnover_pct_bo = round((cap_cost_bo / bz_turnover_cap) * 100, 3) if cap_cost_bo > 0 else 0.0
            bz_turnover_pct_craft_bo = round((cap_cost_craft_bo / bz_turnover_cap) * 100, 3) if cap_cost_craft_bo > 0 else 0.0

            # ------------------------------------------------------------------
            # 多通道盈亏组合预计算 (PnL Matrix)
            # ------------------------------------------------------------------
            def calc_pnl(buy_cost: float, sell_rev: float) -> Dict[str, float]:
                if buy_cost <= 0:
                    return {"profit": 0.0, "roi": 0.0}
                p = round(sell_rev - buy_cost, 2)
                r = round((p / buy_cost) * 100, 2)
                return {"profit": p, "roi": r}

            # 挂单买入 -> 各种退出渠道
            pnl_bo_npc_live = calc_pnl(buy_order_price, live_npc)
            pnl_bo_npc_nerf = calc_pnl(buy_order_price, nerfed_npc) # 烂在手里
            pnl_bo_bz_ask = calc_pnl(buy_order_price, sell_offer_price) # 挂单倒卖
            pnl_bo_bz_bid = calc_pnl(buy_order_price, insta_sell_price) # 秒卖

            # 秒买现货 -> 各种退出渠道
            pnl_ib_npc_live = calc_pnl(insta_buy_price, live_npc)
            pnl_ib_npc_nerf = calc_pnl(insta_buy_price, nerfed_npc)
            pnl_ib_bz_ask = calc_pnl(insta_buy_price, sell_offer_price)
            pnl_ib_bz_bid = calc_pnl(insta_buy_price, insta_sell_price)

            # T1 挂单合成 -> 各种退出渠道 (T2 特有)
            pnl_craft_bo_npc_live = calc_pnl(craft_bo_cost, live_npc) if craft_bo_cost > 0 else {"profit": 0.0, "roi": 0.0}
            pnl_craft_bo_npc_nerf = calc_pnl(craft_bo_cost, nerfed_npc) if craft_bo_cost > 0 else {"profit": 0.0, "roi": 0.0}
            pnl_craft_bo_bz_ask = calc_pnl(craft_bo_cost, sell_offer_price) if craft_bo_cost > 0 else {"profit": 0.0, "roi": 0.0}

            # T1 秒买合成 -> 各种退出渠道 (T2 特有)
            pnl_craft_ib_npc_live = calc_pnl(craft_ib_cost, live_npc) if craft_ib_cost > 0 else {"profit": 0.0, "roi": 0.0}
            pnl_craft_ib_npc_nerf = calc_pnl(craft_ib_cost, nerfed_npc) if craft_ib_cost > 0 else {"profit": 0.0, "roi": 0.0}

            # ------------------------------------------------------------------
            # 状态判定
            # ------------------------------------------------------------------
            ib_has_profit = (pnl_ib_npc_live["profit"] > 0 and insta_buy_price > 0)
            bo_has_profit = (pnl_bo_npc_live["profit"] > 0 and buy_order_price > 0)
            is_permanent_safe = (buy_order_price <= nerfed_npc and buy_order_price > 0)

            bo_discount_pct = round(((live_npc - buy_order_price) / live_npc) * 100, 1) if buy_order_price > 0 else 0.0

            if ib_has_profit:
                status = "INSTA_BUY_ARBITRAGE"
                status_zh = "⚡ 现货破发 (秒买立赚)"
                status_color = "#10b981"
                insta_buy_opps += 1
                buy_order_opps += 1
            elif bo_has_profit:
                status = "BUY_ORDER_ARBITRAGE"
                status_zh = "★ 挂单低吸 (暴利回收)"
                status_color = "#3b82f6"
                buy_order_opps += 1
            elif buy_order_price <= live_npc * 1.05 and buy_order_price > 0:
                status = "NEAR_PARITY"
                status_zh = "⚖️ 接近平价 (贴水震荡)"
                status_color = "#f59e0b"
            else:
                status = "PREMIUM"
                status_zh = "⛔ 溢价运行 (无套利空间)"
                status_color = "#64748b"

            if is_permanent_safe:
                safe_permanent_opps += 1

            if bo_has_profit and pnl_bo_npc_live["roi"] > max_roi_live:
                max_roi_live = pnl_bo_npc_live["roi"]
                max_roi_item = item_def["name"]

            if bo_discount_pct > 0:
                total_panic_weight += bo_discount_pct

            items_result.append({
                "id": pid,
                "name": item_def["name"],
                "family": item_def["family"],
                "tier": tier,
                "multiplier": mult,
                "icon": item_def["icon"],
                # 价格数据
                "buy_order_price": buy_order_price,
                "insta_buy_price": insta_buy_price,
                "sell_offer_price": sell_offer_price,
                "insta_sell_price": insta_sell_price,
                "npc_live": live_npc,
                "npc_nerfed": nerfed_npc,
                "npc_nerf_v1": item_def.get("npc_nerf_v1", nerfed_npc),
                "npc_nerf_v2": item_def.get("npc_nerf_v2", nerfed_npc),
                # T1 合成成本 (仅限 T2)
                "t1_id": t1_id,
                "t1_name": t1_name,
                "t1_bo_price": t1_bo_price,
                "t1_ib_price": t1_ib_price,
                "craft_bo_cost": craft_bo_cost,
                "craft_ib_cost": craft_ib_cost,
                "craft_bo_saving": craft_bo_saving,
                "craft_ib_saving": craft_ib_saving,
                # 多通道 PnL
                "pnl_bo_npc_live": pnl_bo_npc_live,
                "pnl_bo_npc_nerf": pnl_bo_npc_nerf,
                "pnl_bo_bz_ask": pnl_bo_bz_ask,
                "pnl_bo_bz_bid": pnl_bo_bz_bid,
                "pnl_ib_npc_live": pnl_ib_npc_live,
                "pnl_ib_npc_nerf": pnl_ib_npc_nerf,
                "pnl_ib_bz_ask": pnl_ib_bz_ask,
                "pnl_ib_bz_bid": pnl_ib_bz_bid,
                "pnl_craft_bo_npc_live": pnl_craft_bo_npc_live,
                "pnl_craft_bo_npc_nerf": pnl_craft_bo_npc_nerf,
                "pnl_craft_bo_bz_ask": pnl_craft_bo_bz_ask,
                "pnl_craft_ib_npc_live": pnl_craft_ib_npc_live,
                "pnl_craft_ib_npc_nerf": pnl_craft_ib_npc_nerf,
                # 500M NPC 每日限额精算
                "cap_500m_units": cap_500m_units,
                "cap_cost_bo": cap_cost_bo,
                "cap_profit_bo": cap_profit_bo,
                "cap_cost_ib": cap_cost_ib,
                "cap_profit_ib": cap_profit_ib,
                "cap_cost_craft_bo": cap_cost_craft_bo,
                "cap_profit_craft_bo": cap_profit_craft_bo,
                "bz_turnover_pct_bo": bz_turnover_pct_bo,
                "bz_turnover_pct_craft_bo": bz_turnover_pct_craft_bo,
                # 状态与深度
                "status": status,
                "status_zh": status_zh,
                "status_color": status_color,
                "ib_has_profit": ib_has_profit,
                "bo_has_profit": bo_has_profit,
                "is_permanent_safe": is_permanent_safe,
                "bo_discount_pct": bo_discount_pct,
                "buy_volume": buy_volume,
                "sell_volume": sell_volume,
                "buy_orders_count": buy_orders_count,
                "sell_orders_count": sell_orders_count
            })

        # 默认按单日 500M NPC 最大纯利降序排序 (优先推荐最有赚头的标的)
        items_result.sort(key=lambda x: (x["tier"] == "T2", x["cap_profit_bo"]), reverse=True)

        avg_discount = (total_panic_weight / len(self.definitions)) if self.definitions else 0.0
        panic_index = min(100, round(avg_discount * 2.2, 1))

        if panic_index >= 70:
            panic_level = "极重度恐慌倾销 (Extreme Panic Dump)"
            panic_color = "#ef4444"
            panic_advice = "倾销盘极其猛烈，大量商品不仅挂单暴利，甚至出现秒买现货直接破发，抓紧时间进货直卖 NPC！"
        elif panic_index >= 40:
            panic_level = "中高度倾销分化 (Heavy Dumping)"
            panic_color = "#f97316"
            panic_advice = "挂单买入出现超高收益率，部分高阶附魔作物被急售变现，建议重点挂单吸收高 ROI 品种。"
        elif panic_index >= 15:
            panic_level = "轻度恐慌套利 (Moderate Discount)"
            panic_color = "#eab308"
            panic_advice = "市场存在一定折价，适合挑选深度较好的热门农产品稳妥搬砖。"
        else:
            panic_level = "市场情绪相对理性 (Normal)"
            panic_color = "#10b981"
            panic_advice = "大部分作物价格接近或高于 NPC 收购价，请重点关注少数突发错价。"

        now_utc8 = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S")

        return {
            "version": self.version,
            "updated_at": now_utc8,
            "caps_info": {
                "npc_daily_sell_cap": 500_000_000.0,
                "bazaar_daily_turnover_cap": 15_000_000_000.0,
                "reset_time_utc8": "每日 08:00 (UTC 00:00)"
            },
            "summary": {
                "total_monitored": len(self.definitions),
                "insta_buy_opps": insta_buy_opps,
                "buy_order_opps": buy_order_opps,
                "safe_permanent_opps": safe_permanent_opps,
                "max_roi_live": max_roi_live,
                "max_roi_item": max_roi_item or "N/A",
                "panic_index": panic_index,
                "panic_level": panic_level,
                "panic_color": panic_color,
                "panic_advice": panic_advice,
                "announcement_url": "https://hypixel.net/threads/november-3-magic-find-rework-testing-5-accessory-bag-revamp-economy-changes-testing-2.6168638/",
                "previous_announcement_url": "https://hypixel.net/threads/october-29-accessory-bag-revamp-economy-changes.6165308/",
                "patch_note_date": "2026-11-03 (Testing #2 二次大砍)",
                "previous_patch_note_date": "2026-10-29 / 2026-10-30"
            },
            "items": items_result
        }


crop_arbitrage_service = CropArbitrageService()
