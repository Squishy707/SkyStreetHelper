"""
SkyBlock Event Service:
Tracks Mayors, Minister Cole, Mining Fiesta perks, and calculates exact SkyBlock Calendar Fiesta schedules.
Detects upcoming mining fiesta and raw gemstone sell-off dump waves.
"""

import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import requests

HYPIXEL_ELECTION_URL = "https://api.hypixel.net/v2/resources/skyblock/election"

# SkyBlock Epoch: Year 1, Spring 1st, 00:00:00 = 1560275700 Unix Timestamp (June 11, 2019, 17:55:00 UTC)
SB_EPOCH = 1560275700
SB_DAY_SECONDS = 1200          # 20 minutes
SB_MONTH_DAYS = 31            # 31 days per month
SB_MONTH_SECONDS = 37200      # 10 hours 20 minutes
SB_YEAR_DAYS = 372            # 12 months * 31 days = 372 days
SB_YEAR_SECONDS = 446400      # 124 hours = 5 days 4 hours

SB_MONTH_NAMES = {
    1: "Early Spring",
    2: "Spring",
    3: "Late Spring",
    4: "Early Summer",
    5: "Summer",
    6: "Late Summer",
    7: "Early Autumn",
    8: "Autumn",
    9: "Late Autumn",
    10: "Early Winter",
    11: "Winter",
    12: "Late Winter"
}

def get_ordinal_suffix(n: int) -> str:
    if 11 <= (n % 100) <= 13:
        return f"{n}th"
    last = n % 10
    if last == 1:
        return f"{n}st"
    elif last == 2:
        return f"{n}nd"
    elif last == 3:
        return f"{n}rd"
    return f"{n}th"

# In Hypixel SkyBlock official calendar (confirmed by fschatbot.github.io/Skyblock-Calendar):
# Cole's Mining Fiesta schedules 2 Fiestas per SkyBlock Year:
# 1. Early Summer (Month 4), Day 1 00:00:00 to Day 16 23:59:59 (16 in-game days = 19,200s = 5h 20m)
# 2. Early Autumn (Month 7), Day 1 00:00:00 to Day 16 23:59:59 (16 in-game days = 19,200s = 5h 20m)
FIESTA_SPECS = [
    {"month": 4, "season": "Early Summer", "start_day": 1, "end_day": 16},
    {"month": 7, "season": "Early Autumn", "start_day": 1, "end_day": 16}
]

class EventService:
    def __init__(self):
        self._last_election_cache: Dict[str, Any] = {}
        self._last_fetched_ts: float = 0
        self._cache_ttl_sec: float = 120.0  # Cache for 2 minutes

    def get_skyblock_time(self, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """Calculates current in-game SkyBlock date and year from real-world timestamp."""
        ts = timestamp or time.time()
        elapsed = max(0.0, ts - SB_EPOCH)
        cur_year = int(elapsed // SB_YEAR_SECONDS) + 1
        sec_in_year = elapsed % SB_YEAR_SECONDS
        cur_day_in_year = int(sec_in_year // SB_DAY_SECONDS)
        cur_month = int(cur_day_in_year // SB_MONTH_DAYS) + 1
        day_in_month = int(cur_day_in_year % SB_MONTH_DAYS) + 1
        sec_in_day = sec_in_year % SB_DAY_SECONDS
        hour = int(sec_in_day // 50)
        minute = int((sec_in_day % 50) // (50/60))
        
        month_name = SB_MONTH_NAMES.get(cur_month, f"Month {cur_month}")
        day_str = get_ordinal_suffix(day_in_month)
        
        return {
            "sb_year": cur_year,
            "sb_month": cur_month,
            "sb_month_name": month_name,
            "sb_day": day_in_month,
            "sb_day_str": day_str,
            "sb_hour": hour,
            "sb_minute": minute,
            "day_in_year": cur_day_in_year,
            "sec_in_year": sec_in_year,
            "formatted_sb_date": f"Year {cur_year}, {month_name} {day_str}"
        }

    def fetch_election_and_fiesta(self, force: bool = False) -> Dict[str, Any]:
        """
        Fetches official election data and calculates Mining Fiesta schedules and market dump warnings.
        """
        now = time.time()
        if not force and self._last_election_cache and (now - self._last_fetched_ts < self._cache_ttl_sec):
            return self._last_election_cache

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GemFlipper/0.2.2"
        }

        election_data = None
        latency_s = 0.0
        try:
            t0 = time.time()
            resp = requests.get(HYPIXEL_ELECTION_URL, headers=headers, timeout=8)
            latency_s = round(time.time() - t0, 2)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    election_data = data
        except Exception as e:
            print(f"[Event API] [WARN] 获取选举数据失败 ({type(e).__name__}: {e})，使用推算逻辑")

        # Parse mayor, minister, and perks
        result = self._analyze_election_and_fiesta(election_data, latency_s)
        self._last_election_cache = result
        self._last_fetched_ts = now
        return result

    def _analyze_election_and_fiesta(self, data: Optional[Dict[str, Any]], latency_s: float) -> Dict[str, Any]:
        now = time.time()
        sb_time = self.get_skyblock_time(now)
        
        cur_mayor_name = "Paul"
        cur_mayor_perks = []
        cur_minister_name = "Cole"
        cur_minister_perk = "Mining Fiesta"
        ongoing_election = None
        
        if data:
            mayor_info = data.get("mayor", {})
            cur_mayor_name = mayor_info.get("name", "Unknown")
            cur_mayor_perks = [p.get("name") for p in mayor_info.get("perks", [])]
            
            minister_info = mayor_info.get("minister", {})
            cur_minister_name = minister_info.get("name", "None")
            
            # Minister perk can be a dict under 'perk' or a list under 'perks'
            if "perk" in minister_info and isinstance(minister_info["perk"], dict):
                cur_minister_perk = minister_info["perk"].get("name", "")
            elif "perks" in minister_info and isinstance(minister_info["perks"], list) and minister_info["perks"]:
                cur_minister_perk = minister_info["perks"][0].get("name", "")
            else:
                cur_minister_perk = ""
                
            ongoing_election = data.get("current")

        # Check if Mining Fiesta is active in current administration
        cole_is_mayor = (cur_mayor_name.upper() == "COLE")
        cole_is_minister = (cur_minister_name.upper() == "COLE")
        
        mayor_has_fiesta = cole_is_mayor and any("MINING FIESTA" in p.upper() for p in cur_mayor_perks)
        minister_has_fiesta = cole_is_minister and ("MINING FIESTA" in cur_minister_perk.upper())
        fiesta_enabled = mayor_has_fiesta or minister_has_fiesta

        # Molten Forge check
        all_active_perks = list(cur_mayor_perks)
        if cur_minister_perk:
            all_active_perks.append(cur_minister_perk)
        molten_forge_active = any("MOLTEN FORGE" in p.upper() for p in all_active_perks)

        # Check candidate status in ongoing election (if any)
        cole_running_with_fiesta = False
        cole_is_leading = False
        candidate_summary = []
        
        if ongoing_election and "candidates" in ongoing_election:
            candidates = ongoing_election.get("candidates", [])
            sorted_candidates = sorted(candidates, key=lambda c: c.get("votes", 0), reverse=True)
            for idx, c in enumerate(sorted_candidates):
                c_name = c.get("name", "")
                c_votes = c.get("votes", 0)
                c_perks = [p.get("name") for p in c.get("perks", [])]
                is_cole = (c_name.upper() == "COLE")
                has_fiesta = is_cole and any("MINING FIESTA" in p.upper() for p in c_perks)
                
                if has_fiesta:
                    cole_running_with_fiesta = True
                    if idx == 0:
                        cole_is_leading = True
                        
                candidate_summary.append({
                    "name": c_name,
                    "votes": c_votes,
                    "perks": c_perks,
                    "is_leading": (idx == 0),
                    "has_fiesta": has_fiesta
                })

        # Calculate Fiesta time windows for current and next SkyBlock Year
        cur_year = sb_time["sb_year"]
        fiesta_windows = []
        active_fiesta = None
        next_fiesta = None
        
        # Check current year and next year to ensure upcoming fiesta is found
        window_idx = 1
        for yr in [cur_year, cur_year + 1]:
            yr_start_ts = SB_EPOCH + ((yr - 1) * SB_YEAR_SECONDS)
            for spec in FIESTA_SPECS:
                m = spec["month"]
                season_name = spec["season"]
                start_day_in_yr = (m - 1) * SB_MONTH_DAYS + (spec["start_day"] - 1)
                end_day_in_yr = (m - 1) * SB_MONTH_DAYS + spec["end_day"]
                
                start_ts = yr_start_ts + (start_day_in_yr * SB_DAY_SECONDS)
                end_ts = yr_start_ts + (end_day_in_yr * SB_DAY_SECONDS)
                
                is_active = (start_ts <= now <= end_ts)
                is_past = (now > end_ts)
                is_upcoming = (now < start_ts)
                
                ingame_date_str = f"Year {yr}, {season_name} {get_ordinal_suffix(spec['start_day'])} - {get_ordinal_suffix(spec['end_day'])}"
                
                f_info = {
                    "fiesta_index": window_idx,
                    "year": yr,
                    "season": season_name,
                    "ingame_date_str": ingame_date_str,
                    "start_timestamp": int(start_ts),
                    "end_timestamp": int(end_ts),
                    "start_time_local": self._format_local_time(start_ts),
                    "end_time_local": self._format_local_time(end_ts),
                    "is_active": is_active,
                    "is_past": is_past,
                    "is_upcoming": is_upcoming,
                    "seconds_to_start": max(0, int(start_ts - now)),
                    "seconds_to_end": max(0, int(end_ts - now))
                }
                
                if yr == cur_year or (yr == cur_year + 1 and len(fiesta_windows) < 4):
                    f_info["is_obsolete"] = True
                    f_info["obsolete_notice"] = "2026市长更新已移除离散分场排期机制，原时间预测已停用"
                    fiesta_windows.append(f_info)
                    window_idx += 1
                
                if is_active and active_fiesta is None:
                    active_fiesta = f_info
                elif is_upcoming and next_fiesta is None:
                    next_fiesta = f_info

        # Determine overall Fiesta Status (2026 Hypixel Mayor Update Overhaul)
        # In 2026 Mayor Update, Hypixel removed the old discrete "5 sessions, 2h20m each" mechanism.
        # Mining Fiesta is now a continuous 24/7 permanent event throughout Cole's term whenever the perk is active!
        if fiesta_enabled:
            fiesta_status = "ACTIVE"
            fiesta_title = "Cole 采矿节全程常驻生效中 (2026新机制)"
            fiesta_desc = "2026市长更新：采矿节已改为 Cole 任期全程 24/7 全天候常驻生效！全服持续享有 +75 采矿时运与精炼矿物/Glossy掉落。旧版 5 场离散时间预测已作废。"
            market_risk = "CONTINUOUS_SUPPLY"
            market_advice = "⛏️ 2026新规常驻采矿节进行中：原料供给持续充沛稳定，低成本微瑕宝石货源充足，可按需批量合成，避免过度囤积原料。"
            active_fiesta = {
                "fiesta_index": 1,
                "is_continuous": True,
                "ingame_date_str": "Cole 任期全程 (24/7 常驻)",
                "start_time_local": "任期开始",
                "end_time_local": "任期结束",
                "is_active": True,
                "is_past": False,
                "is_upcoming": False,
                "seconds_to_start": 0,
                "seconds_to_end": 0,
                "is_obsolete": False
            }
            next_fiesta = None
        elif cole_is_leading and cole_running_with_fiesta:
            fiesta_status = "ELECTION_PREDICTED"
            fiesta_title = "预测下任期常驻采矿节 (Cole 选票领先)"
            fiesta_desc = "当前市长选举中 Cole 遥遥领先，若当选新任期将 24/7 全程常驻激活 Mining Fiesta（旧版分场机制已废弃）。"
            market_risk = "ANTICIPATED_DUMP"
            market_advice = "📢 选情预测：Cole 极大几率当选！预计就任后将开启全程常驻采矿节，初级宝石成本将进一步平稳走低。"
            active_fiesta = None
            next_fiesta = None
        else:
            fiesta_status = "NONE"
            fiesta_title = "暂无采矿节生效"
            fiesta_desc = "当前市长或部长未点亮 Mining Fiesta 特技。在 2026 新机制下，采矿节仅在 Cole 特技激活时全天候 24/7 常驻生效。"
            market_risk = "NORMAL"
            market_advice = "当前市场处于常规供求周期，宝石价格受日常矿洞活动支配。"
            active_fiesta = None
            next_fiesta = None

        return {
            "success": True,
            "latency_s": latency_s,
            "mayor": cur_mayor_name,
            "minister": cur_minister_name,
            "all_perks": all_active_perks,
            "molten_forge_active": molten_forge_active,
            "fiesta_enabled": fiesta_enabled,
            "cur_sb_date": sb_time["formatted_sb_date"],
            "skyblock_time": sb_time,
            "administration": {
                "mayor": cur_mayor_name,
                "mayor_perks": cur_mayor_perks,
                "minister": cur_minister_name,
                "minister_perk": cur_minister_perk,
                "cole_active": (cole_is_mayor or cole_is_minister),
                "molten_forge_active": molten_forge_active,
                "fiesta_enabled": fiesta_enabled
            },
            "fiesta": {
                "status": fiesta_status,
                "title": fiesta_title,
                "description": fiesta_desc,
                "market_risk": market_risk,
                "market_advice": market_advice,
                "is_2026_continuous": True,
                "is_schedule_obsolete": True,
                "rule_update_notice": "2026市长更新：移除了原有的随机安排/离散分场活动，采矿节在 Cole 特技激活时全程 24/7 常驻生效，旧版时间预测已作废。",
                "active_fiesta": active_fiesta,
                "next_fiesta": next_fiesta,
                "all_windows": fiesta_windows
            },
            "election": {
                "has_ongoing_election": bool(ongoing_election),
                "cole_running_with_fiesta": cole_running_with_fiesta,
                "cole_is_leading": cole_is_leading,
                "candidates": candidate_summary
            }
        }

    def _format_local_time(self, ts: float) -> str:
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        beijing_tz = timezone(timedelta(hours=8))
        return dt.astimezone(beijing_tz).strftime("%m-%d %H:%M")

    def _format_duration(self, seconds: int) -> str:
        if seconds <= 0:
            return "0分"
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        if hours > 0:
            return f"{hours}小时{mins}分"
        return f"{mins}分"
