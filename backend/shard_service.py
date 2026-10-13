import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import requests

# Thresholds per rarity: [cumul for level 0, 1, 2, ..., 10]
RARITY_THRESHOLDS = {
    "C": [0, 1, 4, 9, 15, 22, 30, 40, 54, 72, 96],
    "U": [0, 1, 3, 6, 10, 15, 21, 28, 36, 48, 64],
    "R": [0, 1, 3, 6, 9, 13, 17, 22, 28, 36, 48],
    "E": [0, 1, 2, 4, 6, 9, 12, 16, 20, 25, 32],
    "L": [0, 1, 2, 3, 5, 7, 9, 12, 15, 19, 24],
}

# Max shards per rarity
RARITY_MAX = {
    "C": 96,
    "U": 64,
    "R": 48,
    "E": 32,
    "L": 24,
}

# Mapping aliases between Excel dataset and Hypixel Bazaar Product IDs
BAZAAR_ID_ALIASES = {
    "SHARD_ZEALOT_BRUISER": "SHARD_BRUISER",
    "SHARD_FIELD_MOUSE": "SHARD_PEST",
    "SHARD_BOGGED": "SHARD_SEA_ARCHER",
    "SHARD_INKLING": "SHARD_NIGHT_SQUID",
    "SHARD_STRIDERSURFER": "SHARD_STRIDER_SURFER",
    "SHARD_WITHER_SPECTRE": "SHARD_WITHER_SPECTER",
    "SHARD_BEETLE": "SHARD_CROPEETLE",
    "SHARD_LOCH_EMPEROR": "SHARD_SEA_EMPEROR",
    "SHARD_ABYSSAL_LANTERNFISH": "SHARD_ABYSSAL_LANTERN",
    "SHARD_EARTHWORM": "SHARD_TERMITE",
    "SHARD_LOTUSFISH": "SHARD_LOTUS_FISH",
    "SHARD_CINDERBAT": "SHARD_CINDER_BAT",
    "SHARD_SEASHINE": "SHARD_SEA_SHINE",
    "SHARD_FLIPFLOPPER": "SHARD_FLIP_FLOPPER",
    "SHARD_END_STONE_PROTECTOR": "SHARD_ENDSTONE_PROTECTOR",
    "SHARD_INFERNO_DEMONLORD": "SHARD_BURNINGSOUL",
}

# Inverse alias lookup
BAZAAR_REVERSE_ALIASES = {v: k for k, v in BAZAAR_ID_ALIASES.items()}

# Special synergy categories
ECHO_SHARDS = {
    "Tiamat", "Iguana", "Komodo Dragon", "Caiman", "Alligator", 
    "Sea Serpent", "Gecko", "Queen Snake", "Molthorn", "Wyvern", 
    "Starborn", "Doomspiral", "Cuboa", "Goldolot"
}

ATOMIZED_SHARDS = {
    "Star Sentry", "Thyst", "Stalagmight", "Pangolin", "Iguana"
}

def clean_effect_text(text: Any) -> str:
    """Cleans up arrow and encoding artifacts to standard tilde range notation (e.g. 1~10%)."""
    if not text:
        return ""
    s = str(text)
    # Only replace actual arrow characters or Unicode replacement chars
    s = s.replace("\u2192", "~").replace("→", "~").replace("\ufffd", "~").replace("–", "~").replace("—", "~")
    return s.strip()

class ShardService:
    def __init__(self, data_path: str = "backend/shard_data.json"):
        self.data_path = data_path
        self.shards_dict: Dict[str, Dict[str, Any]] = {}
        self.shards_list: List[Dict[str, Any]] = []
        self._player_cache: Dict[str, Any] = {}
        self.metadata: Dict[str, Any] = {
            "dictionary_name": "SkyBlock Shards Master Dictionary (325 Shards)",
            "current_app_version": "alpha 0.3.3",
            "last_game_update_date": "2026-10-06",
            "last_game_update_title": "October 6, 2026 Update (321 Shards -> 325 Shards)",
            "total_shards": 325,
            "maintenance_mode": "Local Maintenance / SkyShards & Wiki Aligned"
        }
        self._load_database()

    def _load_database(self) -> None:
        """Loads and normalizes the master shard dictionary from CSV or JSON."""
        self.shards_dict.clear()
        self.shards_list.clear()

        if getattr(sys, 'frozen', False):
            base_dir = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
        else:
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

        loaded_from_csv = False
        csv_path = os.path.join(base_dir, "backend", "data", "shard_dictionary.csv")
        if not os.path.exists(csv_path):
            csv_path = "backend/data/shard_dictionary.csv"

        if os.path.exists(csv_path):
            try:
                import csv
                with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
                    rows = list(csv.reader(f))
                if len(rows) > 1:
                    for row in rows[1:]:
                        if not row or len(row) < 13 or not row[1]:
                            continue
                        tag = str(row[0] or "").strip()
                        s_id = str(row[1] or "").strip()
                        name = str(row[2] or "").strip()
                        attr = str(row[3] or "").strip()
                        rarity = str(row[4] or "C").strip().upper()
                        rarity_lvl = int(float(row[5] or 1))
                        total = int(float(row[6] or RARITY_MAX.get(rarity, 96)))
                        category = str(row[7] or "Combat").strip()
                        family = str(row[8] or "Unknown").strip()
                        acq = str(row[9] or "Direct").strip()
                        lvl_range = str(row[10] or "I->X").strip()
                        eff = clean_effect_text(row[11] or "")
                        hunt = str(row[12] or "").strip()

                        # Synergy tagging
                        synergy = "Standard"
                        if name in ECHO_SHARDS or "echo" in attr.lower():
                            synergy = "Echo (Synergy Link)"
                        elif name in ATOMIZED_SHARDS or "atomiz" in attr.lower():
                            synergy = "Atomized (Powder Buff)"
                        elif category == "Global":
                            synergy = "Global (Universal Buff)"
                        elif "elemental" in family.lower():
                            synergy = "Elemental (Family Link)"

                        bz_id = BAZAAR_ID_ALIASES.get(s_id, s_id)

                        item = {
                            "tag": tag,
                            "shard_id": s_id,
                            "shard_name": name,
                            "attribute_name": attr,
                            "rarity": rarity,
                            "rarity_lvl": rarity_lvl,
                            "total": total,
                            "category": category,
                            "shard_family": family,
                            "acquisition": acq,
                            "level_range": lvl_range,
                            "attribute_effect": eff,
                            "how_to_hunt": hunt,
                            "synergy_tag": synergy,
                            "bazaar_product_id": bz_id
                        }
                        self.shards_dict[s_id] = item
                        self.shards_list.append(item)
                    loaded_from_csv = True
            except Exception as e:
                print(f"[Shard Service] [WARN] 读取本地 CSV 词典失败: {e}，正在回退至 JSON 格式。")

        if not loaded_from_csv:
            raw_shards = []
            json_path = os.path.join(base_dir, "backend", "shard_data.json")
            target_json = json_path if os.path.exists(json_path) else self.data_path
            if os.path.exists(target_json):
                with open(target_json, "r", encoding="utf-8") as f:
                    raw_shards = json.load(f)

            for item in raw_shards:
                s_id = item.get("shard_id", "").strip()
                item["attribute_effect"] = clean_effect_text(item.get("attribute_effect", ""))
                name = item.get("shard_name", "")
                attr = item.get("attribute_name", "")
                cat = item.get("category", "")
                family = item.get("shard_family", "")

                synergy = "Standard"
                if name in ECHO_SHARDS or "echo" in attr.lower():
                    synergy = "Echo (Synergy Link)"
                elif name in ATOMIZED_SHARDS or "atomiz" in attr.lower():
                    synergy = "Atomized (Powder Buff)"
                elif cat == "Global":
                    synergy = "Global (Universal Buff)"
                elif "elemental" in family.lower():
                    synergy = "Elemental (Family Link)"

                item["synergy_tag"] = synergy
                item["bazaar_product_id"] = BAZAAR_ID_ALIASES.get(s_id, s_id)
                self.shards_dict[s_id] = item
                self.shards_list.append(item)

        # Ensure the 4 latest (Oct 2026) shards are included if missing
        self._ensure_recent_shards()
        print(f"[Shard Service] [READY] 成功载入 {len(self.shards_list)} 个 Shard 词典数据库 (版本: {self.metadata.get('current_app_version', 'alpha 0.3.3')})。")

    def _ensure_recent_shards(self) -> None:
        """Appends recent 2026 shards if missing."""
        recent_shards = [
            {
                "tag": "U107",
                "rarity": "U",
                "rarity_lvl": 2,
                "number": "107",
                "shard_id": "SHARD_CHOCOBUN",
                "shard_name": "Chocobun",
                "attribute_name": "Hopping Luck",
                "acquisition": "Direct",
                "shard_family": "Chocolate Family",
                "category": "Global",
                "level_range": "I->X",
                "base_rate": 0.0,
                "attribute_effect": "Increases chance of finding higher tier Chocolate Factory rabbits or bonuses by 1~10%.",
                "how_to_hunt": "* Catch during Hoppity's Hunt. * Obtain from Chocolate Factory.",
                "total": 64,
                "synergy_tag": "Global (Universal Buff)",
                "bazaar_product_id": "SHARD_CHOCOBUN"
            },
            {
                "tag": "R72",
                "rarity": "R",
                "rarity_lvl": 3,
                "number": "72",
                "shard_id": "SHARD_FLORA",
                "shard_name": "Flora",
                "attribute_name": "Blooming Fortune",
                "acquisition": "Direct",
                "shard_family": "Garden Family",
                "category": "Farming",
                "level_range": "I->X",
                "base_rate": 0.0,
                "attribute_effect": "Grants 3~30 Farming Fortune when harvesting flowers or crops.",
                "how_to_hunt": "* Catch Garden Pests. * Catch Flora mob with Lasso.",
                "total": 48,
                "synergy_tag": "Standard",
                "bazaar_product_id": "SHARD_FLORA"
            },
            {
                "tag": "E53",
                "rarity": "E",
                "rarity_lvl": 4,
                "number": "53",
                "shard_id": "SHARD_FOLF",
                "shard_name": "Folf",
                "attribute_name": "Canine Instinct",
                "acquisition": "Direct",
                "shard_family": "Wolf Family",
                "category": "Combat",
                "level_range": "I->X",
                "base_rate": 0.0,
                "attribute_effect": "Grants 2~20% more Damage against Canine and Wolf monsters.",
                "how_to_hunt": "* Catch Folf in Howling Cave / The Park while using Salts.",
                "total": 32,
                "synergy_tag": "Standard",
                "bazaar_product_id": "SHARD_FOLF"
            },
            {
                "tag": "L61",
                "rarity": "L",
                "rarity_lvl": 5,
                "number": "61",
                "shard_id": "SHARD_BURNINGSOUL",
                "shard_name": "Burningsoul",
                "attribute_name": "Blaze Spirit",
                "acquisition": "Direct",
                "shard_family": "Smoldering Family",
                "category": "Combat",
                "level_range": "I->X",
                "base_rate": 0.0,
                "attribute_effect": "Increases Attack Speed by 1~10 and boosts Damage against Nether mobs.",
                "how_to_hunt": "* Catch in Crimson Isle / Smoldering Tomb with Pocket Black Hole.",
                "total": 24,
                "synergy_tag": "Standard",
                "bazaar_product_id": "SHARD_BURNINGSOUL"
            }
        ]

        existing_ids = {s.get("shard_id") for s in self.shards_list}
        for item in recent_shards:
            if item["shard_id"] not in existing_ids:
                self.shards_dict[item["shard_id"]] = item
                self.shards_list.append(item)

    @staticmethod
    def calculate_level_info(rarity: str, eaten: int) -> Dict[str, Any]:
        """
        Calculates level (0-10), progress to next tier (+1 XP), and remaining to max.
        """
        rarity_clean = rarity.upper() if rarity else "C"
        thresholds = RARITY_THRESHOLDS.get(rarity_clean, RARITY_THRESHOLDS["C"])
        max_total = RARITY_MAX.get(rarity_clean, 96)

        eaten = max(0, min(eaten, max_total))

        # Find current level
        current_level = 0
        for lvl in range(10, -1, -1):
            if eaten >= thresholds[lvl]:
                current_level = lvl
                break

        is_maxed = (current_level >= 10) or (eaten >= max_total)
        remaining_to_max = max(0, max_total - eaten)
        remaining_xp = max(0, 10 - current_level)

        if is_maxed:
            shards_to_next = 0
        else:
            next_threshold = thresholds[current_level + 1]
            shards_to_next = max(0, next_threshold - eaten)

        return {
            "current_level": current_level,
            "current_eaten": eaten,
            "max_total": max_total,
            "remaining_to_max": remaining_to_max,
            "shards_to_next": shards_to_next,
            "xp_earned": current_level,
            "remaining_xp": remaining_xp,
            "is_maxed": is_maxed,
            "completion_pct": round((eaten / max_total) * 100, 1) if max_total > 0 else 0
        }

    def fetch_player_profiles(self, ign: str) -> Dict[str, Any]:
        """Fetches profile list for given IGN from SkyShards API."""
        clean_ign = ign.strip()
        if not clean_ign:
            return {"success": False, "error": "请输入有效的玩家名称 (IGN)"}

        # Check cache
        cache_key = f"prof_{clean_ign.lower()}"
        cached = self._player_cache.get(cache_key)
        if cached and (time.time() - cached["ts"]) < 60:
            return cached["data"]

        url = f"https://api.skyshards.com/skyshards/profile/{clean_ign}"
        try:
            headers = {"User-Agent": "SkyblockTracker/3.0"}
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code != 200:
                return {"success": False, "error": f"SkyShards 接口响应失败 (HTTP {resp.status_code})"}

            data = resp.json()
            profiles_raw = data.get("profiles", [])
            if not profiles_raw:
                return {"success": False, "error": f"未找到玩家 {clean_ign} 的有效 Skyblock 档案"}

            profiles_list = []
            selected_profile = None

            for item in profiles_raw:
                p_meta = item.get("profile", {})
                cute_name = p_meta.get("cute_name", "Unknown")
                selected = bool(p_meta.get("selected", False))
                last_save = p_meta.get("last_save")
                attrs = item.get("attributes", [])

                # Format last_save to GMT+8
                last_save_str = ""
                if last_save:
                    try:
                        tz_beijing = timezone(timedelta(hours=8))
                        dt = datetime.fromtimestamp(last_save / 1000.0, tz=timezone.utc).astimezone(tz_beijing)
                        last_save_str = dt.strftime("%Y-%m-%d %H:%M:%S")
                    except Exception:
                        pass

                p_info = {
                    "cute_name": cute_name,
                    "selected": selected,
                    "last_save_ms": last_save,
                    "last_save_str": last_save_str,
                    "attributes_count": len(attrs)
                }
                profiles_list.append(p_info)

                if selected or selected_profile is None:
                    selected_profile = p_info

            result = {
                "success": True,
                "ign": clean_ign,
                "profiles": profiles_list,
                "selected_profile": selected_profile,
                "raw_data": profiles_raw
            }

            self._player_cache[cache_key] = {"ts": time.time(), "data": result}
            return result

        except Exception as e:
            return {"success": False, "error": f"请求玩家档案异常: {str(e)}"}

    def get_player_attribute_levels(self, ign: str, profile_cute_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Gets a dict mapping attribute name / tag to eaten count.
        """
        prof_res = self.fetch_player_profiles(ign)
        if not prof_res.get("success"):
            return prof_res

        raw_profiles = prof_res.get("raw_data", [])
        chosen_item = None

        if profile_cute_name:
            for item in raw_profiles:
                if str(item.get("profile", {}).get("cute_name", "")).lower() == profile_cute_name.lower():
                    chosen_item = item
                    break

        if not chosen_item:
            # Fallback to selected profile or first
            for item in raw_profiles:
                if item.get("profile", {}).get("selected"):
                    chosen_item = item
                    break
            if not chosen_item and raw_profiles:
                chosen_item = raw_profiles[0]

        if not chosen_item:
            return {"success": False, "error": "未匹配到指定存档"}

        p_meta = chosen_item.get("profile", {})
        attrs = chosen_item.get("attributes", [])

        # Build eaten mapping by attribute name (lowercase) and id/tag
        eaten_by_attr: Dict[str, int] = {}
        eaten_by_tag: Dict[str, int] = {}

        for a in attrs:
            a_id = str(a.get("id", "")).strip().upper()
            a_name = str(a.get("name", "")).strip().lower()
            lvl = int(a.get("level", 0))
            if a_id:
                eaten_by_tag[a_id] = lvl
            if a_name:
                eaten_by_attr[a_name] = lvl

        return {
            "success": True,
            "ign": prof_res["ign"],
            "profile": p_meta,
            "profiles_list": prof_res.get("profiles", []),
            "eaten_by_attr": eaten_by_attr,
            "eaten_by_tag": eaten_by_tag
        }

    def build_shard_tracker_data(
        self, 
        bazaar_products: Dict[str, Any], 
        player_eaten_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Merges Shard knowledge base with live Bazaar pricing and player progress.
        Computes Max-out prices, next-level prices, cheapest XP, and synergy groupings.
        """
        eaten_by_attr = player_eaten_data.get("eaten_by_attr", {}) if player_eaten_data else {}
        eaten_by_tag = player_eaten_data.get("eaten_by_tag", {}) if player_eaten_data else {}

        items = []

        # Totals for summary
        total_tracked = len(self.shards_list)
        total_maxed = 0
        total_xp_earned = 0
        total_possible_xp = total_tracked * 10
        total_eaten_shards = 0
        total_shards_needed = 0

        total_cost_max_order = 0.0
        total_cost_max_instant = 0.0

        rarity_counts = {"C": 0, "U": 0, "R": 0, "E": 0, "L": 0}
        rarity_maxed = {"C": 0, "U": 0, "R": 0, "E": 0, "L": 0}

        for s in self.shards_list:
            s_id = s["shard_id"]
            bz_id = s["bazaar_product_id"]
            rarity = s["rarity"]
            tag = s["tag"]
            attr_name = s["attribute_name"]

            rarity_counts[rarity] = rarity_counts.get(rarity, 0) + 1

            # Match player eaten progress
            eaten = 0
            if tag in eaten_by_tag:
                eaten = eaten_by_tag[tag]
            elif attr_name.lower() in eaten_by_attr:
                eaten = eaten_by_attr[attr_name.lower()]

            # Progress details
            prog = self.calculate_level_info(rarity, eaten)
            cur_lvl = prog["current_level"]
            rem_to_max = prog["remaining_to_max"]
            shards_to_next = prog["shards_to_next"]
            is_maxed = prog["is_maxed"]
            rem_xp = prog["remaining_xp"]

            if is_maxed:
                total_maxed += 1
                rarity_maxed[rarity] = rarity_maxed.get(rarity, 0) + 1

            total_xp_earned += cur_lvl
            total_eaten_shards += prog["current_eaten"]
            total_shards_needed += prog["max_total"]

            # Bazaar data lookup
            p_data = bazaar_products.get(bz_id, {})
            # Also try original shard_id or alias
            if not p_data:
                p_data = bazaar_products.get(s_id, {})

            qs = p_data.get("quick_status", {})
            sell_summary = p_data.get("sell_summary", [])
            buy_summary = p_data.get("buy_summary", [])

            # Extract accurate prices
            has_bo = len(sell_summary) > 0
            has_ib = len(buy_summary) > 0

            # Buy Order (Pre-order price from top buyer)
            if has_bo:
                bo_price = float(sell_summary[0].get("pricePerUnit", 0.0))
            else:
                bo_price = float(qs.get("buyPrice", 0.0) or 0.0)

            # Instant Buy (Immediate offer price from top seller)
            if has_ib:
                ib_price = float(buy_summary[0].get("pricePerUnit", 0.0))
            else:
                ib_price = float(qs.get("sellPrice", 0.0) or 0.0)

            order_anomaly = None
            if not has_bo and not has_ib and not p_data:
                order_anomaly = "NO_MARKET"
            elif not has_bo:
                order_anomaly = "NO_ORDER"
            elif not has_ib:
                order_anomaly = "NO_OFFER"

            buy_vol = int(qs.get("buyVolume", 0) or 0)
            sell_vol = int(qs.get("sellVolume", 0) or 0)
            weekly_vol = int((qs.get("buyMovingWeek", 0) or 0) + (qs.get("sellMovingWeek", 0) or 0))
            orders_count = int(qs.get("buyOrders", 0) or len(sell_summary))

            # Costs to Next Tier & Max Out
            cost_to_next_bo = round(shards_to_next * bo_price, 1)
            cost_to_next_ib = round(shards_to_next * ib_price, 1)

            cost_to_max_bo = round(rem_to_max * bo_price, 1)
            cost_to_max_ib = round(rem_to_max * ib_price, 1)

            if not is_maxed:
                total_cost_max_order += cost_to_max_bo
                total_cost_max_instant += cost_to_max_ib

            # XP Efficiency Metrics
            # Coins per remaining XP (when maxing out)
            coins_per_max_xp_bo = round(cost_to_max_bo / rem_xp, 1) if rem_xp > 0 and cost_to_max_bo > 0 else 0
            coins_per_max_xp_ib = round(cost_to_max_ib / rem_xp, 1) if rem_xp > 0 and cost_to_max_ib > 0 else 0

            # Coins for the immediate next 1 XP
            coins_per_next_xp_bo = cost_to_next_bo if shards_to_next > 0 else 0
            coins_per_next_xp_ib = cost_to_next_ib if shards_to_next > 0 else 0

            item_entry = {
                "tag": tag,
                "rarity": rarity,
                "rarity_lvl": s.get("rarity_lvl", 1),
                "shard_id": s_id,
                "bazaar_product_id": bz_id,
                "shard_name": s["shard_name"],
                "attribute_name": s["attribute_name"],
                "category": s.get("category", "Combat"),
                "shard_family": s.get("shard_family", "Unknown"),
                "acquisition": s.get("acquisition", "Direct"),
                "attribute_effect": s.get("attribute_effect", ""),
                "how_to_hunt": s.get("how_to_hunt", ""),
                "synergy_tag": s.get("synergy_tag", "Standard"),
                
                # Progression
                "current_level": cur_lvl,
                "current_eaten": prog["current_eaten"],
                "max_total": prog["max_total"],
                "remaining_to_max": rem_to_max,
                "shards_to_next": shards_to_next,
                "xp_earned": cur_lvl,
                "remaining_xp": rem_xp,
                "is_maxed": is_maxed,
                "completion_pct": prog["completion_pct"],

                # Pricing
                "bo_price": bo_price,
                "ib_price": ib_price,
                "order_anomaly": order_anomaly,
                "buy_volume": buy_vol,
                "sell_volume": sell_vol,
                "weekly_volume": weekly_vol,
                "orders_count": orders_count,

                # Total Cost
                "cost_to_next_bo": cost_to_next_bo,
                "cost_to_next_ib": cost_to_next_ib,
                "cost_to_max_bo": cost_to_max_bo,
                "cost_to_max_ib": cost_to_max_ib,

                # Efficiency
                "coins_per_next_xp_bo": coins_per_next_xp_bo,
                "coins_per_next_xp_ib": coins_per_next_xp_ib,
                "coins_per_max_xp_bo": coins_per_max_xp_bo,
                "coins_per_max_xp_ib": coins_per_max_xp_ib,
            }
            items.append(item_entry)

        # Build summary
        summary = {
            "total_tracked": total_tracked,
            "total_maxed": total_maxed,
            "maxed_pct": round((total_maxed / total_tracked) * 100, 1) if total_tracked > 0 else 0,
            "total_xp_earned": total_xp_earned,
            "total_possible_xp": total_possible_xp,
            "xp_pct": round((total_xp_earned / total_possible_xp) * 100, 1) if total_possible_xp > 0 else 0,
            "total_eaten_shards": total_eaten_shards,
            "total_shards_needed": total_shards_needed,
            "total_cost_max_order": round(total_cost_max_order, 1),
            "total_cost_max_instant": round(total_cost_max_instant, 1),
            "rarity_counts": rarity_counts,
            "rarity_maxed": rarity_maxed
        }

        return {
            "items": items,
            "summary": summary,
            "dict_metadata": self.metadata
        }

# Global singleton
shard_service = ShardService()
