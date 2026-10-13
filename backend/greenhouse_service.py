"""
Greenhouse Mutation Tracker & Calculator Service
Hypixel SkyBlock 温室突变收益、产出与农业幸运 (ff) 计算服务
"""

import os
import sys
import csv
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("GreenhouseService")
logger.setLevel(logging.INFO)

def get_base_dir() -> str:
    """获取程序运行基础目录，兼容 PyInstaller 单文件打包与源码运行"""
    if getattr(sys, 'frozen', False):
        return getattr(sys, '_MEIPASS', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_DIR = os.path.join(get_base_dir(), "backend", "data")
CSV_PATH = os.path.join(DATA_DIR, "greenhouse_mutations.csv")
JSON_PATH = os.path.join(DATA_DIR, "greenhouse_mutations.json")

class GreenhouseService:
    def __init__(self):
        self.version = "alpha 0.4.1"
        self.mutations: List[Dict[str, Any]] = []
        self.base_crops: List[Dict[str, Any]] = []
        self.npc_prices: Dict[str, float] = {}
        self.aloe_stages: Dict[int, float] = {}
        self.jellybean_stages: Dict[int, float] = {}
        self.load_data()

    def load_data(self):
        """从本地 JSON 种子文件或 CSV 字典文件中加载数据"""
        loaded = False
        if os.path.exists(JSON_PATH):
            try:
                self._load_from_json(JSON_PATH)
                logger.info(f"成功从 JSON 种子加载温室突变数据: {len(self.mutations)} 种突变, {len(self.base_crops)} 种基础作物")
                loaded = True
            except Exception as e:
                logger.error(f"读取 JSON 种子突变数据失败: {e}")

        if os.path.exists(CSV_PATH):
            try:
                self._load_mutations_from_csv(CSV_PATH)
                logger.info(f"成功从 CSV 同步温室突变字典: {len(self.mutations)} 种突变")
                loaded = True
            except Exception as e:
                logger.warning(f"读取 CSV 突变字典失败，保留 JSON 数据: {e}")

        if not loaded:
            logger.error("未找到有效的温室突变数据源！")

    def _load_from_json(self, path: str):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.version = data.get("version", "alpha 0.4.1")
            self.base_crops = data.get("base_crops", [])
            self.mutations = data.get("mutations", [])
            self.aloe_stages = {int(k): float(v) for k, v in data.get("aloe_stages", {}).items()}
            self.jellybean_stages = {int(k): float(v) for k, v in data.get("jellybean_stages", {}).items()}
            self.npc_prices = {c["name_en"]: c["npc_price"] for c in self.base_crops}

    def _load_mutations_from_csv(self, path: str):
        mutations = []
        with open(path, "r", encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
        for row in rows[1:]:
            if not row or len(row) < 17 or not row[0]:
                continue
            (mid, name_en, name_zh, rarity, size, surface,
             substrates, sub_count, max_per_gh, drops_json,
             effects, yield_buff, yield_debuff, has_imm, has_mult,
             def_mult, bz_id) = row[:17]

            drops = {}
            if drops_json:
                try:
                    drops = json.loads(str(drops_json))
                except Exception:
                    drops = {}

            mutations.append({
                "id": str(mid),
                "name_en": str(name_en),
                "name_zh": str(name_zh),
                "rarity": str(rarity),
                "size": str(size),
                "growth_surface": str(surface),
                "substrates_text": str(substrates or ""),
                "substrate_count": int(float(sub_count or 0)),
                "max_per_gh": int(float(max_per_gh or 16)),
                "base_drops": drops,
                "effects_text": str(effects or ""),
                "yield_buff": float(yield_buff or 0),
                "yield_debuff": float(yield_debuff or 0),
                "has_immunity": str(has_imm).upper() in ["YES", "TRUE", "1"],
                "has_multiplier": str(has_mult).upper() in ["YES", "TRUE", "1"],
                "default_multiplier": float(def_mult or 1.0),
                "bazaar_id": str(bz_id or mid)
            })
        if mutations:
            self.mutations = mutations

    def get_mutations_payload(self, bazaar_prices: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """返回供前端渲染的全量突变数据、NPC 基础价格、阶段倍率与实时 Bazaar 价格"""
        enriched_mutations = []
        bazaar_data = bazaar_prices or {}

        for m in self.mutations:
            m_copy = dict(m)
            bz_id = m.get("bazaar_id", m["id"])
            bz_info = bazaar_data.get(bz_id, {})
            # 读取集市卖出价与买入价
            sell_price = bz_info.get("sellPrice", 0.0)
            buy_price = bz_info.get("buyPrice", 0.0)
            m_copy["bazaar_sell_price"] = sell_price
            m_copy["bazaar_buy_price"] = buy_price
            enriched_mutations.append(m_copy)

        return {
            "version": self.version,
            "mutations": enriched_mutations,
            "base_crops": self.base_crops,
            "npc_prices": self.npc_prices,
            "aloe_stages": self.aloe_stages,
            "jellybean_stages": self.jellybean_stages
        }

    def calculate_returns(self,
                          mutation_id: str,
                          farming_fortune: float = 3100.0,
                          greenhouse_upgrade: float = 20.0,
                          unique_crops_bonus: float = 25.0,
                          positive_buff: float = 0.0,
                          negative_debuff: float = 0.0,
                          has_immunity: bool = False,
                          evergreen_chip: float = 1.60,
                          multiplier: float = 1.0,
                          mutations_count: int = 1,
                          custom_drops: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        核心收益计算公式：
        农作物掉落 = (1 + yield总和%) * Evergreen chip加成 * 原始农作物掉落 * ((农业幸运 + 对应作物幸运)/100 + 1) * 修正值 * 总突变数
        突变掉落 = (1 + yield总和%) * 修正值 * 总突变数
        基础收益 = ∑ 农作物掉落 * NPC 单价
        """
        # 1. 查找目标突变
        target = next((m for m in self.mutations if m["id"] == mutation_id), None)
        if not target and self.mutations:
            target = self.mutations[0]

        # 2. 计算 Yield 总和%
        # 规则：若有免疫效果，负面效果清零；正负取加和
        actual_debuff = 0.0 if has_immunity else negative_debuff
        total_yield_pct = greenhouse_upgrade + unique_crops_bonus + positive_buff + actual_debuff
        yield_multiplier = 1.0 + (total_yield_pct / 100.0)

        # 3. 基础掉落字典
        drops_dict = custom_drops if custom_drops is not None else (target.get("base_drops", {}) if target else {})

        # 4. 计算每种基础农作物掉落与 NPC 价值
        ff_factor = (farming_fortune / 100.0) + 1.0
        chip_factor = evergreen_chip
        mult_factor = multiplier

        crop_results = []
        total_npc_revenue = 0.0

        for crop_name, base_count in drops_dict.items():
            # 单株产出
            single_drop = yield_multiplier * chip_factor * float(base_count) * ff_factor * mult_factor
            # 总产出 (乘以总突变数)
            total_drop = single_drop * mutations_count
            npc_price = self.npc_prices.get(crop_name, 4.0)
            crop_npc_value = total_drop * npc_price
            total_npc_revenue += crop_npc_value

            # 分级包装折算 (普通、附魔 160x、压缩/紧实 25600x)
            compacted_count = int(total_drop // 25600)
            rem_after_comp = total_drop % 25600
            enchanted_count = int(rem_after_comp // 160)
            normal_count = round(rem_after_comp % 160, 1)

            crop_results.append({
                "crop_name": crop_name,
                "base_drop_per_plant": base_count,
                "single_plant_drop": round(single_drop, 2),
                "total_drop": round(total_drop, 1),
                "npc_price": npc_price,
                "npc_revenue": round(crop_npc_value, 2),
                "compacted": compacted_count,
                "enchanted": enchanted_count,
                "normal": normal_count
            })

        # 5. 突变本体掉落数量
        # 突变掉落 = (1 + yield总和%) * 修正值 * 总突变数
        single_mut_drop = yield_multiplier * mult_factor
        total_mut_drop = single_mut_drop * mutations_count

        # 特殊处理：如果是 All-in Aloe，计算碎片与合成全株
        aloe_fragments = 0.0
        aloe_crafted_full = 0
        aloe_leftover_fragments = 0.0
        if target and target["id"] == "ALL_IN_ALOE":
            aloe_fragments = total_mut_drop
            aloe_crafted_full = int(aloe_fragments // 9)
            aloe_leftover_fragments = round(aloe_fragments % 9, 2)

        return {
            "mutation_id": target["id"] if target else mutation_id,
            "mutation_name_en": target["name_en"] if target else mutation_id,
            "mutation_name_zh": target["name_zh"] if target else "",
            "rarity": target["rarity"] if target else "COMMON",
            "mutations_count": mutations_count,
            "yield_breakdown": {
                "greenhouse_upgrade": greenhouse_upgrade,
                "unique_crops_bonus": unique_crops_bonus,
                "positive_buff": positive_buff,
                "negative_debuff": actual_debuff,
                "has_immunity": has_immunity,
                "total_yield_pct": round(total_yield_pct, 2),
                "yield_multiplier": round(yield_multiplier, 4)
            },
            "parameters": {
                "farming_fortune": farming_fortune,
                "evergreen_chip": evergreen_chip,
                "multiplier": mult_factor
            },
            "crops": crop_results,
            "total_npc_revenue": round(total_npc_revenue, 2),
            "mutation_drop": {
                "single_plant_drop": round(single_mut_drop, 2),
                "total_drop": round(total_mut_drop, 2),
                "aloe_details": {
                    "fragments": round(aloe_fragments, 2),
                    "full_aloe": aloe_crafted_full,
                    "leftover_fragments": aloe_leftover_fragments
                } if target and target["id"] == "ALL_IN_ALOE" else None
            }
        }

# 单例全局实例
greenhouse_service = GreenhouseService()
