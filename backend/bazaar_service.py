"""
Bazaar Service:
Fetches, caches, and manages Hypixel Bazaar market data and election status.
Includes resilient failover and rich, informative console logging.
"""

import csv
import os
import sys
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
import requests

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

HYPIXEL_BAZAAR_URL = "https://api.hypixel.net/v2/skyblock/bazaar"
HYPIXEL_ELECTION_URL = "https://api.hypixel.net/v2/resources/skyblock/election"

class BazaarService:
    def __init__(self, csv_backup_path: str = "backend/data/bazaar_fallback.csv"):
        self.csv_backup_path = csv_backup_path
        self._cache: Dict[str, Any] = {}
        self._last_updated_ms: int = 0
        self._last_fetched_time: Optional[datetime] = None
        self._last_election_info: Dict[str, Any] = {}
        self._election_last_fetched: float = 0
        self._is_live: bool = False
        self._data_source: str = "Local CSV Snapshot (Fallback)"
        self._last_latency_s: float = 0.0

        self._last_local_fetch_ts: float = 0.0
        self._fetch_lock = threading.Lock()
        self._election_lock = threading.Lock()

        # Load initial data from CSV as immediate baseline
        self._load_from_csv()

        # Attempt initial live fetch immediately
        print("[System] [INIT] 正在尝试与 Hypixel 官方 API 建立首次连接...")
        self.fetch_live_bazaar(force=True)
        self.fetch_live_election(force=True)

    def _load_from_csv(self) -> None:
        """Loads baseline products from bazaar_fallback.csv in case network is down."""
        try:
            if not os.path.exists(self.csv_backup_path):
                return
            products = {}
            with open(self.csv_backup_path, "r", encoding="utf-8-sig", newline="") as f:
                reader = csv.reader(f)
                rows = list(reader)
                for row in rows[1:]:
                    if not row or not row[0]:
                        continue
                    item_id = str(row[0]).strip()
                    buy_price = float(row[1] or 0) if len(row) > 1 else 0.0
                    sell_price = float(row[2] or 0) if len(row) > 2 else 0.0
                    buy_volume = int(float(row[3] or 0)) if len(row) > 3 else 0
                    sell_volume = int(float(row[4] or 0)) if len(row) > 4 else 0
                    buy_moving_week = int(float(row[5] or 0)) if len(row) > 5 else 0
                    sell_moving_week = int(float(row[6] or 0)) if len(row) > 6 else 0

                    products[item_id] = {
                        "product_id": item_id,
                        "quick_status": {
                            "productId": item_id,
                            "buyPrice": buy_price,
                            "sellPrice": sell_price,
                            "buyVolume": buy_volume,
                            "sellVolume": sell_volume,
                            "buyMovingWeek": buy_moving_week,
                            "sellMovingWeek": sell_moving_week
                        }
                    }
            self._cache = products
            self._last_updated_ms = int(time.time() * 1000)
            self._last_local_fetch_ts = time.time()
            self._last_fetched_time = datetime.now()
            self._is_live = False
            self._data_source = "Local CSV Snapshot (Baseline)"
            print(f"[Bazaar Data] [INFO] 已预载本地 CSV 备用快照: 共 {len(products)} 项商品 ({self.csv_backup_path})")
        except Exception as e:
            print(f"[Bazaar Data] [WARN] 读取 CSV 备用快照失败: {e}")

    def fetch_live_bazaar(self, force: bool = False, max_age_seconds: int = 60) -> Dict[str, Any]:
        """
        Fetches live data from Hypixel API if cache is older than max_age_seconds or forced.
        Uses threading lock to prevent simultaneous duplicate requests from multiple worker threads.
        """
        with self._fetch_lock:
            now = time.time()
            local_age = (now - self._last_local_fetch_ts) if self._last_local_fetch_ts else 999.0
            
            if not force and self._cache and local_age < max_age_seconds:
                return self._format_response()

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SkyblockTracker/3.0.0"
            }
            
            print(f"\n[Bazaar API] [FETCH] 正在向 Hypixel 官方请求实时 Bazaar 数据 (强制={force}) ...")
            t0 = time.time()
            try:
                resp = requests.get(HYPIXEL_BAZAAR_URL, headers=headers, timeout=(6, 12))
                latency = round(time.time() - t0, 2)
                self._last_latency_s = latency
                self._last_local_fetch_ts = time.time()

                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("success"):
                        self._cache = data.get("products", {})
                        self._last_updated_ms = data.get("lastUpdated", int(now * 1000))
                        self._last_fetched_time = datetime.now()
                        self._is_live = True
                        self._data_source = "Hypixel Official Live API"
                        
                        dt_str = self._format_beijing_time(self._last_updated_ms)
                        print(f"[Bazaar API] [OK] 成功拉取实时数据: 获得 {len(self._cache)} 件商品 | 耗时: {latency}s | 市场时间: {dt_str}")
                        return self._format_response()
                    else:
                        print(f"[Bazaar API] [WARN] Hypixel 接口返回失败: {data.get('cause')}")
                else:
                    print(f"[Bazaar API] [WARN] Hypixel HTTP 异常状态码: {resp.status_code}")
            except Exception as e:
                latency = round(time.time() - t0, 2)
                self._last_latency_s = latency
                self._last_local_fetch_ts = time.time()  # Prevent immediate repeated retry storms
                print(f"[Bazaar API] [WARN] 连接 Hypixel 失败 ({type(e).__name__}: {e})，耗时 {latency}s。正在启用本地快照备用数据。")

            # Fallback to existing cached data
            return self._format_response(warning="Used cached or snapshot data due to API connection delay.")

    def fetch_live_election(self, force: bool = False, max_age_seconds: int = 300) -> Dict[str, Any]:
        """
        Fetches election data from Hypixel to detect Mayor, Minister, and Molten Forge perk.
        Uses threading lock to serialize election checks.
        """
        with self._election_lock:
            now = time.time()
            if not force and self._last_election_info and (now - self._election_last_fetched < max_age_seconds):
                return self._last_election_info

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SkyblockTracker/3.0.0"
            }
            
            print(f"[Election API] [FETCH] 正在从 Hypixel 获取当前市长与选举信息...")
            t0 = time.time()
            try:
                resp = requests.get(HYPIXEL_ELECTION_URL, headers=headers, timeout=8)
                latency = round(time.time() - t0, 2)
                self._election_last_fetched = time.time()
                if resp.status_code == 200:
                    data = resp.json()
                    mayor_info = data.get("mayor", {})
                    current_mayor_name = mayor_info.get("name", "Unknown")
                    perks = [p.get("name") for p in mayor_info.get("perks", [])]
                    
                    minister_info = mayor_info.get("minister", {})
                    minister_name = minister_info.get("name", "None")
                    minister_perks = [p.get("name") for p in minister_info.get("perks", [])] if minister_info else []
                    
                    cole_is_mayor = current_mayor_name.upper() == "COLE"
                    cole_is_minister = minister_name.upper() == "COLE"
                    
                    all_active_perks = perks + minister_perks
                    molten_forge_active = any("MOLTEN FORGE" in p.upper() for p in all_active_perks)
                    
                    self._last_election_info = {
                        "success": True,
                        "mayor": current_mayor_name,
                        "minister": minister_name,
                        "mayor_perks": perks,
                        "minister_perks": minister_perks,
                        "all_perks": all_active_perks,
                        "cole_active": (cole_is_mayor or cole_is_minister),
                        "molten_forge_active": molten_forge_active,
                        "latency_s": latency,
                        "last_checked": datetime.now().isoformat()
                    }
                    self._election_last_fetched = now
                    
                    perk_str = f"Molten Forge 锻炉减免 = {'生效 (-25%)' if molten_forge_active else '未生效'}"
                    print(f"[Election API] [OK] 选举信息获取成功 (耗时 {latency}s): 市长 = {current_mayor_name}, 部长 = {minister_name} | {perk_str}")
                    return self._last_election_info
            except Exception as e:
                self._election_last_fetched = time.time()
                print(f"[Election API] [WARN] 选举信息获取失败 ({type(e).__name__}: {e})，已采用默认配置。")

            # Default fallback
            self._last_election_info = {
                "success": False,
                "mayor": "Paul",
                "minister": "Cole",
                "mayor_perks": ["Marauder"],
                "minister_perks": [],
                "all_perks": ["Marauder"],
                "cole_active": True,
                "molten_forge_active": False,
                "last_checked": datetime.now().isoformat()
            }
            return self._last_election_info

    def _format_beijing_time(self, ms: int) -> str:
        dt_utc = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
        beijing_tz = timezone(timedelta(hours=8))
        return dt_utc.astimezone(beijing_tz).strftime("%Y-%m-%d %H:%M:%S (UTC+8)")

    def _format_response(self, warning: Optional[str] = None) -> Dict[str, Any]:
        dt_beijing = self._format_beijing_time(self._last_updated_ms)

        return {
            "success": True,
            "is_live": self._is_live,
            "data_source": self._data_source,
            "latency_s": self._last_latency_s,
            "warning": warning,
            "last_updated_ms": self._last_updated_ms,
            "last_updated_beijing": dt_beijing,
            "products_count": len(self._cache),
            "products": self._cache
        }
