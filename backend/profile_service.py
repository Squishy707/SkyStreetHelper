"""
Profile Service:
Resolves Minecraft player UUIDs across multiple endpoints (Mojang Official, PlayerDB, CraftHead),
queries Skyblock profiles (HotM, Quick Forge perks), and outputs real-time console logging.
"""

import sys
from typing import Dict, Any, Optional
import requests

# HotM XP Table (Cumulative XP for HotM 1 to 10)
HOTM_XP_TABLE = [
    0,         # HotM 1
    3000,      # HotM 2
    12000,     # HotM 3
    37000,     # HotM 4
    97000,     # HotM 5
    247000,    # HotM 6
    547000,    # HotM 7
    997000,    # HotM 8 (Glacite Tunnels)
    1647000,   # HotM 9
    2547000    # HotM 10
]

def calculate_hotm_level(exp: float) -> int:
    """Calculates Heart of the Mountain level from experience."""
    level = 1
    for lvl, req in enumerate(HOTM_XP_TABLE, 1):
        if exp >= req:
            level = lvl
        else:
            break
    return min(10, level)

class ProfileService:
    def __init__(self):
        pass

    def resolve_uuid(self, username: str) -> Optional[Dict[str, str]]:
        """
        Multi-tier resilient UUID resolver:
        1. Mojang Official API
        2. PlayerDB.co
        3. CraftHead.net
        """
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SkyblockTracker/2.0"
        }

        # --- Tier 1: Mojang Official API ---
        try:
            url = f"https://api.mojang.com/users/profiles/minecraft/{username}"
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("id"):
                    return {
                        "username": data.get("name", username),
                        "id": data.get("id"),
                        "raw_id": data.get("id"),
                        "source": "Mojang 官方 API"
                    }
        except Exception as e:
            print(f"[Player API] [INFO] Mojang 节点未响应 ({e})，切换备用解析源...")

        # --- Tier 2: PlayerDB.co ---
        try:
            url = f"https://playerdb.co/api/player/minecraft/{username}"
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "player.found":
                    p = data.get("data", {}).get("player", {})
                    return {
                        "username": p.get("username", username),
                        "id": p.get("id"),
                        "raw_id": p.get("raw_id") or p.get("id"),
                        "source": "PlayerDB"
                    }
        except Exception as e:
            print(f"[Player API] [INFO] PlayerDB 节点未响应 ({e})，切换备用解析源...")

        # --- Tier 3: CraftHead.net ---
        try:
            url = f"https://crafthead.net/profile/{username}"
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("id"):
                    return {
                        "username": data.get("name", username),
                        "id": data.get("id"),
                        "raw_id": data.get("id"),
                        "source": "CraftHead"
                    }
        except Exception:
            pass

        return None

    def fetch_player_hotm(
        self,
        username: str,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Attempts to fetch HotM and Quick Forge levels.
        If API key provided, queries Hypixel official endpoint.
        Otherwise provides resolved identity with standard mining defaults.
        """
        print(f"\n[Player API] [SEARCH] 正在检索玩家 IGN: '{username}' ...")
        player_info = self.resolve_uuid(username)
        
        if not player_info:
            print(f"[Player API] [ERR] 未能找到玩家 '{username}'。请检查拼写或网络连接。")
            return {
                "success": False,
                "message": f"未找到正版玩家 '{username}'，请检查名称拼写或稍后重试。",
                "hotm_level": 7,
                "quick_forge_level": 20
            }

        uuid = player_info.get("raw_id") or player_info.get("id")
        clean_name = player_info.get("username", username)
        source = player_info.get("source", "API")

        print(f"[Player API] [OK] 成功解析玩家: {clean_name} (UUID: {uuid[:8]}...) [来源: {source}]")

        if not api_key:
            print(f"[Player API] [INFO] 未提供 Hypixel API Key，已应用标准预设参数 (HotM 7, Quick Forge 20, 槽位 5)")
            return {
                "success": True,
                "player": clean_name,
                "uuid": uuid,
                "source": source,
                "has_api_key": False,
                "message": f"已匹配玩家: {clean_name}！已载入 HotM 7 标准配置 (可手动调节下方滑块)。",
                "hotm_level": 7,
                "quick_forge_level": 20,
                "recommended_forge_slots": 5
            }

        # Attempt to query Hypixel Profiles API with key
        print(f"[Player API] [SYNC] 正在向 Hypixel Profiles API 请求玩家档案 (UUID: {uuid}) ...")
        try:
            url = f"https://api.hypixel.net/v2/skyblock/profiles?uuid={uuid}"
            headers = {
                "API-Key": api_key,
                "User-Agent": "SkyblockTracker/2.0"
            }
            resp = requests.get(url, headers=headers, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                profiles = data.get("profiles", [])
                if not profiles:
                    print(f"[Player API] [WARN] 玩家 {clean_name} 未创建 SkyBlock 档案。")
                    return {
                        "success": True,
                        "player": clean_name,
                        "uuid": uuid,
                        "message": f"玩家 {clean_name} 无 SkyBlock 档案，已载入标准预设。",
                        "hotm_level": 7,
                        "quick_forge_level": 20,
                        "recommended_forge_slots": 5
                    }

                # Find selected profile
                selected_profile = None
                for p in profiles:
                    if p.get("selected"):
                        selected_profile = p
                        break
                if not selected_profile:
                    selected_profile = profiles[0]

                profile_name = selected_profile.get("cute_name", "Unknown")
                member_data = selected_profile.get("members", {}).get(uuid, {})
                mining_core = member_data.get("mining_core", {})
                
                exp = mining_core.get("experience", 0)
                hotm_level = calculate_hotm_level(exp)
                
                nodes = mining_core.get("nodes", {})
                quick_forge_level = nodes.get("quick_forge", 0)
                
                forge_slots = 2
                if hotm_level >= 7:
                    forge_slots = 7
                elif hotm_level >= 5:
                    forge_slots = 5
                elif hotm_level >= 3:
                    forge_slots = 3

                print(f"[Player API] [OK] 档案同步成功: Profile '{profile_name}' | HotM {hotm_level} | Quick Forge {quick_forge_level}级 | 推荐槽位 {forge_slots}")

                return {
                    "success": True,
                    "player": clean_name,
                    "uuid": uuid,
                    "profile_name": profile_name,
                    "hotm_level": hotm_level,
                    "hotm_exp": exp,
                    "quick_forge_level": quick_forge_level,
                    "recommended_forge_slots": forge_slots,
                    "message": f"已成功从 Hypixel 同步 '{clean_name}' (档案: {profile_name})！HotM: {hotm_level}, Quick Forge: {quick_forge_level}级"
                }
            else:
                print(f"[Player API] [WARN] Hypixel 响应状态码: {resp.status_code} ({resp.text[:80]})")
        except Exception as e:
            print(f"[Player API] [WARN] 同步 Hypixel 档案异常: {e}")

        return {
            "success": True,
            "player": clean_name,
            "uuid": uuid,
            "message": f"玩家 {clean_name} 匹配成功，已载入预设配置。",
            "hotm_level": 7,
            "quick_forge_level": 20,
            "recommended_forge_slots": 5
        }
