"""
FastAPI Server for SkyBlock Gemstone Flipper Pro
Handles API routing, calculation requests, real-time Bazaar updates, and serves the frontend.
"""

import os
import sys
import time
import signal
import threading

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.bazaar_service import BazaarService
from backend.event_service import EventService
from backend.price_tracker import PriceTracker
from backend.flipper_engine import calculate_gem_flipper, GEMSTONE_METADATA, TIER_AMT_BASE, extract_product_pricing
from backend.profile_service import ProfileService
from backend.shard_service import shard_service
from backend.greenhouse_service import greenhouse_service

# Resolve base directories (supporting both raw python and PyInstaller standalone .exe)
if getattr(sys, 'frozen', False):
    BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
else:
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

STATIC_DIR = os.path.join(BASE_DIR, "static")
EXCEL_PATH = os.path.join(BASE_DIR, "gemflipper.xlsx")

app = FastAPI(
    title="SkyStreetHelper API",
    description="Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator (alpha 0.4.1)",
    version="alpha 0.4.1"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
bazaar_service = BazaarService(excel_backup_path=EXCEL_PATH)
event_service = EventService()
price_tracker = PriceTracker()
profile_service = ProfileService()

# Pydantic models for request bodies
class CalculateRequest(BaseModel):
    forges: int = Field(default=1, ge=1, le=7)
    hotm_level: int = Field(default=7, ge=1, le=10)
    quick_forge_level: int = Field(default=20, ge=0, le=20)
    cole_active: bool = Field(default=False)
    tax_rate: float = Field(default=0.01, ge=0.0, le=0.1)
    crystal_filter: Optional[int] = Field(default=None)
    tier_filter: Optional[str] = Field(default=None)

class PlayerLookupRequest(BaseModel):
    username: str
    api_key: Optional[str] = None

class SimulationRequest(BaseModel):
    gem: str
    tier: str = "FLAWED"
    amount: float = 6400.0
    buy_price_override: Optional[float] = None
    sell_price_override: Optional[float] = None
    perfect_sell_override: Optional[float] = None
    forges: int = 1
    quick_forge_level: int = 20
    cole_active: bool = False
    tax_rate: float = 0.01

# Endpoints

@app.get("/api/bazaar")
def get_bazaar_data(force: bool = False):
    """Returns the cached or freshly fetched Bazaar data."""
    data = bazaar_service.fetch_live_bazaar(force=force)
    price_tracker.record_snapshot(data.get("products", {}))
    return data

@app.post("/api/bazaar/refresh")
def refresh_bazaar_data():
    """Forces an immediate refresh of the Bazaar, Event, and Election data."""
    print("\n[User Action] [REFRESH] 收到前端手动刷新请求 (POST /api/bazaar/refresh) ...")
    data = bazaar_service.fetch_live_bazaar(force=True)
    price_tracker.record_snapshot(data.get("products", {}))
    event_info = event_service.fetch_election_and_fiesta(force=True)
    return {
        "success": True,
        "message": "Bazaar 与采矿节事件情报已成功刷新！",
        "last_updated_ms": data.get("last_updated_ms"),
        "last_updated_beijing": data.get("last_updated_beijing"),
        "is_live": data.get("is_live"),
        "data_source": data.get("data_source"),
        "latency_s": data.get("latency_s"),
        "event_context": event_info
    }

@app.get("/api/election")
def get_election_data():
    """Returns live election and Mayor Cole status."""
    return event_service.fetch_election_and_fiesta()

@app.get("/api/events")
def get_events_data():
    """Returns SkyBlock calendar, elections, and upcoming Mining Fiesta schedules."""
    return event_service.fetch_election_and_fiesta()

@app.get("/api/bazaar/preview_items")
def get_bazaar_preview_items():
    """
    Returns an ordered preview of all 60 gemstone tiers and 2 crystal recipe items (62 items in total).
    Ordered by gemstone complexity (S -> A -> B -> C -> GTMS -> OPAL),
    with tiers ordered from Rough (top) to Perfect (bottom), followed by the 2 Crystal items.
    """
    bazaar_resp = bazaar_service.fetch_live_bazaar()
    products = bazaar_resp.get("products", {})
    last_updated_ms = bazaar_resp.get("last_updated_ms", int(time.time() * 1000))
    last_updated_beijing = bazaar_resp.get("last_updated_beijing", "")

    ordered_gems = [
        ("TOPAZ", "Topaz", "黄玉", "S级: 速刷", "#fbbf24"),
        ("AMBER", "Amber", "琥珀", "S级: 速刷", "#f59e0b"),
        ("SAPPHIRE", "Sapphire", "蓝宝石", "A级: 蓝宝石", "#38bdf8"),
        ("JADE", "Jade", "翡翠", "B级: 慢刷", "#22c55e"),
        ("AMETHYST", "Amethyst", "紫水晶", "B级: 慢刷", "#a855f7"),
        ("JASPER", "Jasper", "碧玉", "C级: 限跑水晶", "#f43f5e"),
        ("RUBY", "Ruby", "红宝石", "C级: 限跑水晶", "#ef4444"),
        ("AQUAMARINE", "Aquamarine", "海蓝宝石", "GTMS only", "#06b6d4"),
        ("ONYX", "Onyx", "缟玛瑙", "GTMS only", "#64748b"),
        ("CITRINE", "Citrine", "黄水晶", "GTMS only", "#ea580c"),
        ("PERIDOT", "Peridot", "橄榄石", "GTMS only", "#84cc16"),
        ("OPAL", "Opal", "蛋白石", "OPAL: 蛋白石", "#e2e8f0"),
    ]

    tier_order = [
        ("ROUGH", "Rough", "粗糙"),
        ("FLAWED", "Flawed", "微瑕"),
        ("FINE", "Fine", "精致"),
        ("FLAWLESS", "Flawless", "无瑕"),
        ("PERFECT", "★Perfect", "★完美")
    ]

    items = []
    index = 1

    # 1. 60 Gemstone Tiers (Rough -> Perfect)
    for gem_key, gem_en, gem_cn, grade, color in ordered_gems:
        for tier_key, tier_en, tier_cn in tier_order:
            item_id = f"{tier_key}_{gem_key}_GEM"
            p_data = products.get(item_id, {})
            pricing = extract_product_pricing(p_data)
            qs = p_data.get("quick_status", {})

            buy_price = pricing["bo_price"]   # Buy Order / 预购买入价 (from sell_summary[0])
            sell_price = pricing["ib_price"]  # Instant Buy / 秒买现货价 (from buy_summary[0])
            has_bo = pricing["has_buy_order"]
            has_ib = pricing["has_sell_offer"]
            order_anomaly = pricing["order_anomaly"]

            buy_vol = int(qs.get("buyVolume", 0) or 0)
            sell_vol = int(qs.get("sellVolume", 0) or 0)
            weekly_vol = int((qs.get("buyMovingWeek", 0) or 0) + (qs.get("sellMovingWeek", 0) or 0))

            items.append({
                "index": index,
                "item_id": item_id,
                "gem": gem_key,
                "gem_en": gem_en,
                "gem_cn": gem_cn,
                "tier": tier_key,
                "tier_en": tier_en,
                "tier_cn": tier_cn,
                "display_name": f"{gem_en} ({gem_cn}) - {tier_en} ({tier_cn})",
                "grade": grade,
                "color": color,
                "buy_price": round(buy_price, 1),
                "sell_price": round(sell_price, 1),
                "has_buy_order": has_bo,
                "has_sell_offer": has_ib,
                "order_anomaly": order_anomaly,
                "buy_volume": buy_vol,
                "sell_volume": sell_vol,
                "weekly_volume": weekly_vol
            })
            index += 1

    # 2. 2 Crystal Items
    crystal_items = [
        ("JUNGLE_KEY", "Jungle Key", "丛林钥匙", "B级: 慢刷配方道具", "#a855f7"),
        ("PRECURSOR_APPARATUS", "Precursor Apparatus", "先行者装置", "A级: 蓝宝石配方道具", "#38bdf8")
    ]

    for item_id, item_en, item_cn, grade, color in crystal_items:
        p_data = products.get(item_id, {})
        pricing = extract_product_pricing(p_data)
        qs = p_data.get("quick_status", {})

        buy_price = pricing["bo_price"]
        sell_price = pricing["ib_price"]
        has_bo = pricing["has_buy_order"]
        has_ib = pricing["has_sell_offer"]
        order_anomaly = pricing["order_anomaly"]

        buy_vol = int(qs.get("buyVolume", 0) or 0)
        sell_vol = int(qs.get("sellVolume", 0) or 0)
        weekly_vol = int((qs.get("buyMovingWeek", 0) or 0) + (qs.get("sellMovingWeek", 0) or 0))

        items.append({
            "index": index,
            "item_id": item_id,
            "gem": "CRYSTAL",
            "gem_en": item_en,
            "gem_cn": item_cn,
            "tier": "CRYSTAL",
            "tier_en": "Recipe Item",
            "tier_cn": "配方道具",
            "display_name": f"{item_en} ({item_cn})",
            "grade": grade,
            "color": color,
            "buy_price": round(buy_price, 1),
            "sell_price": round(sell_price, 1),
            "has_buy_order": has_bo,
            "has_sell_offer": has_ib,
            "order_anomaly": order_anomaly,
            "buy_volume": buy_vol,
            "sell_volume": sell_vol,
            "weekly_volume": weekly_vol
        })
        index += 1

    return {
        "success": True,
        "timestamp_ms": last_updated_ms,
        "timestamp_beijing": last_updated_beijing,
        "total_items": len(items),
        "items": items
    }

@app.post("/api/calculate")
def calculate_flips(req: CalculateRequest):
    """
    Computes flipping profitability, ROI, forge times, recommendations,
    volume liquidity, price trends, and anomaly alerts.
    """
    bazaar_resp = bazaar_service.fetch_live_bazaar()
    products = bazaar_resp.get("products", {})
    price_tracker.record_snapshot(products)
    
    # Calculate flips with price tracker
    results = calculate_gem_flipper(
        bazaar_products=products,
        forges=req.forges,
        quick_forge_level=req.quick_forge_level,
        cole_active=req.cole_active,
        tax_rate=req.tax_rate,
        crystal_filter=req.crystal_filter,
        tier_filter=req.tier_filter,
        price_tracker=price_tracker
    )
    
    # Add metadata and event / fiesta intelligence context
    event_info = event_service.fetch_election_and_fiesta()
    results["election_context"] = event_info.get("administration", {})
    results["event_context"] = event_info
    results["fiesta_context"] = event_info.get("fiesta", {})
    results["last_updated_ms"] = bazaar_resp.get("last_updated_ms")
    results["last_updated_beijing"] = bazaar_resp.get("last_updated_beijing")
    results["is_live_data"] = bazaar_resp.get("is_live", False)
    results["data_source"] = bazaar_resp.get("data_source")
    results["latency_s"] = bazaar_resp.get("latency_s")
    
    # Include HotM unlock status for Perfect gems (Requires HotM 5)
    results["hotm_unlocked"] = (req.hotm_level >= 5)
    results["hotm_level"] = req.hotm_level
    
    return results

@app.get("/api/anomalies")
def get_market_anomalies():
    """Scans and returns all quantified price and liquidity anomalies."""
    bazaar_resp = bazaar_service.fetch_live_bazaar()
    products = bazaar_resp.get("products", {})
    calc = calculate_gem_flipper(bazaar_products=products, forges=1, price_tracker=price_tracker)
    return {
        "success": True,
        "count": len(calc.get("anomaly_alerts", [])),
        "anomalies": calc.get("anomaly_alerts", []),
        "last_updated_beijing": bazaar_resp.get("last_updated_beijing")
    }

@app.get("/api/arbitrage")
def get_arbitrage_alerts():
    """Scans and returns all items currently priced below NPC sell price."""
    bazaar_resp = bazaar_service.fetch_live_bazaar()
    products = bazaar_resp.get("products", {})
    calc = calculate_gem_flipper(bazaar_products=products, forges=1, price_tracker=price_tracker)
    return {
        "success": True,
        "count": len(calc["arbitrage_alerts"]),
        "alerts": calc["arbitrage_alerts"],
        "anomaly_alerts": calc.get("anomaly_alerts", []),
        "last_updated_beijing": bazaar_resp.get("last_updated_beijing")
    }

@app.post("/api/player/lookup")
def lookup_player(req: PlayerLookupRequest):
    """Looks up Minecraft player and SkyBlock profile details (alpha 0.2.7: 暂不可用)."""
    return {
        "success": False,
        "message": "IGN 玩家信息查询功能暂不可用 (alpha 0.2.7)",
        "player": req.username
    }

@app.post("/api/simulate")
def simulate_custom_flip(req: SimulationRequest):
    """
    Simulates a custom flip scenario for a specific gem with custom quantities
    and price overrides (matching the Excel FlipCal workflow).
    """
    gem = req.gem.upper()
    if gem not in GEMSTONE_METADATA:
        raise HTTPException(status_code=400, detail=f"Invalid gemstone: {req.gem}")
        
    tier = req.tier.upper()
    if tier not in TIER_AMT_BASE:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {req.tier}")

    bazaar_resp = bazaar_service.fetch_live_bazaar()
    products = bazaar_resp.get("products", {})
    
    # Fetch default prices from live order books
    item_id = f"{tier}_{gem}_GEM"
    item_pricing = extract_product_pricing(products.get(item_id))
    default_buy_price = item_pricing["ib_price"]
    default_sell_price = item_pricing["bo_price"]
    
    perfect_id = f"PERFECT_{gem}_GEM"
    perfect_pricing = extract_product_pricing(products.get(perfect_id))
    default_perfect_offer = perfect_pricing["ib_price"]
    default_perfect_sell = perfect_pricing["bo_price"]
    
    # Precursor Apparatus / Jungle key
    crystal_cost = 0.0
    if gem == "SAPPHIRE":
        prec_pricing = extract_product_pricing(products.get("PRECURSOR_APPARATUS"))
        crystal_cost = prec_pricing["bo_price"] if prec_pricing["has_buy_order"] else prec_pricing["ib_price"]
    elif gem == "AMETHYST":
        jk_pricing = extract_product_pricing(products.get("JUNGLE_KEY"))
        crystal_cost = jk_pricing["bo_price"] if jk_pricing["has_buy_order"] else jk_pricing["ib_price"]
        
    # Overrides
    unit_cost_ib = req.buy_price_override if req.buy_price_override is not None else default_buy_price
    unit_cost_bo = req.sell_price_override if req.sell_price_override is not None else default_sell_price
    unit_sell_offer = req.perfect_sell_override if req.perfect_sell_override is not None else default_perfect_offer
    
    # Number of units specified
    specified_amount = req.amount
    
    # Convert to Rough equivalent
    tier_base_rough = {
        "ROUGH": 1,
        "FLAWED": 80,
        "FINE": 6400,
        "FLAWLESS": 512000
    }[tier]
    
    total_rough = specified_amount * tier_base_rough
    # 2,560,000 Rough = 1 Perfect
    perfects_produced = total_rough / 2560000.0
    crystals_needed = perfects_produced
    
    # Costs
    cost_material_ib = specified_amount * unit_cost_ib
    cost_material_bo = specified_amount * unit_cost_bo
    cost_crystal_total = crystals_needed * crystal_cost
    
    total_cost_ib = cost_material_ib + cost_crystal_total
    total_cost_bo = cost_material_bo + cost_crystal_total
    
    # Revenue (after tax)
    rev_offer_gross = perfects_produced * unit_sell_offer
    rev_offer_net = rev_offer_gross * (1.0 - req.tax_rate)
    rev_is_net = perfects_produced * default_perfect_sell
    
    # Profits
    max_profit = rev_offer_net - total_cost_bo
    profit_offer_ib = rev_offer_net - total_cost_ib
    profit_is_bo = rev_is_net - total_cost_bo
    min_profit = rev_is_net - total_cost_ib
    
    roi = (max_profit / total_cost_bo) if total_cost_bo > 0 else 0.0
    
    return {
        "gem": gem,
        "tier": tier,
        "amount_input": specified_amount,
        "total_rough_equivalent": total_rough,
        "perfects_crafted": round(perfects_produced, 4),
        "crystals_required": round(crystals_needed, 4),
        "crystal_cost_each": crystal_cost,
        "crystal_cost_total": round(cost_crystal_total, 2),
        "material_cost_buy_order": round(cost_material_bo, 2),
        "material_cost_instant_buy": round(cost_material_ib, 2),
        "total_cost_buy_order": round(total_cost_bo, 2),
        "total_cost_instant_buy": round(total_cost_ib, 2),
        "perfect_revenue_gross": round(rev_offer_gross, 2),
        "perfect_revenue_net": round(rev_offer_net, 2),
        "max_profit": round(max_profit, 2),
        "profit_offer_instant_buy": round(profit_offer_ib, 2),
        "profit_instant_sell_order": round(profit_is_bo, 2),
        "min_profit": round(min_profit, 2),
        "roi": round(roi, 4)
    }

# ==============================================================================
# ShardTracker 属性碎片追踪与最划算经验计算端点 (alpha 3.0.0)
# ==============================================================================
@app.get("/api/shards")
def get_shards_tracker(ign: Optional[str] = None, profile: Optional[str] = None, force: bool = False):
    """
    Returns the comprehensive 325-shard dataset joined with live Bazaar prices
    and optional player attribute menu eaten progress from SkyShards API.
    """
    bazaar_resp = bazaar_service.fetch_live_bazaar(force=force)
    products = bazaar_resp.get("products", {})

    player_data = None
    player_warning = None
    if ign and ign.strip():
        p_res = shard_service.get_player_attribute_levels(ign.strip(), profile)
        if p_res.get("success"):
            player_data = p_res
        else:
            player_warning = p_res.get("error", "无法获取玩家档案，已展示通用全零进度。")

    tracker_data = shard_service.build_shard_tracker_data(products, player_data)

    player_info = None
    if player_data and player_data.get("success"):
        p_meta = player_data.get("profile", {})
        player_info = {
            "ign": player_data.get("ign"),
            "cute_name": p_meta.get("cute_name"),
            "selected": p_meta.get("selected"),
            "last_save_ms": p_meta.get("last_save"),
            "profiles_list": player_data.get("profiles_list", [])
        }

    return {
        "success": True,
        "items": tracker_data["items"],
        "summary": tracker_data["summary"],
        "player_info": player_info,
        "player_warning": player_warning,
        "bazaar_meta": {
            "last_updated_ms": bazaar_resp.get("last_updated_ms"),
            "last_updated_beijing": bazaar_resp.get("last_updated_beijing"),
            "is_live": bazaar_resp.get("is_live"),
            "latency_s": bazaar_resp.get("latency_s")
        }
    }

@app.get("/api/shards/profiles")
def get_player_shard_profiles(ign: str):
    """
    Fetches the list of profiles for a given IGN to allow user to switch profiles in UI.
    """
    if not ign or not ign.strip():
        raise HTTPException(status_code=400, detail="IGN 不能为空")
    res = shard_service.fetch_player_profiles(ign.strip())
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("error", "获取档案失败"))
    return res

@app.get("/api/shards/dictionary")
def get_shards_master_dictionary():
    """
    Returns the complete 325-shard master dictionary with version metadata.
    """
    return {
        "success": True,
        "metadata": shard_service.metadata,
        "total": len(shard_service.shards_list),
        "items": shard_service.shards_list
    }

@app.get("/api/shards/dictionary/download")
def download_shards_dictionary_excel():
    """
    Downloads the local master shard_dictionary.xlsx file.
    """
    dict_file = os.path.join(BASE_DIR, "backend", "data", "shard_dictionary.xlsx")
    if os.path.exists(dict_file):
        return FileResponse(
            dict_file, 
            filename="SkyBlock_Shards_Dictionary_v0.4.0.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    raise HTTPException(status_code=404, detail="Shard 词典文件未就绪")


# ==============================================================================
# 温室突变农业产出与收益计算器 API (alpha 0.4.0)
# ==============================================================================
class GreenhouseCalcRequest(BaseModel):
    mutation_id: str
    farming_fortune: float = 3100.0
    greenhouse_upgrade: float = 20.0
    unique_crops_bonus: float = 25.0
    positive_buff: float = 0.0
    negative_debuff: float = 0.0
    has_immunity: bool = False
    evergreen_chip: float = 1.60
    multiplier: float = 1.0
    mutations_count: int = 1
    custom_drops: Optional[dict] = None

@app.get("/api/greenhouse/mutations")
def get_greenhouse_mutations():
    """
    获取全部温室突变列表，携带最新实时 Bazaar 价格、基础作物 NPC 价与阶段倍率字典
    """
    bz_prices = {}
    if bazaar_service._cache:
        for pid, pdata in bazaar_service._cache.items():
            qs = pdata.get("quick_status", {})
            bz_prices[pid] = {
                "sellPrice": qs.get("sellPrice", 0.0),
                "buyPrice": qs.get("buyPrice", 0.0)
            }
    return JSONResponse(greenhouse_service.get_mutations_payload(bz_prices))

@app.post("/api/greenhouse/calculate")
def calculate_greenhouse(req: GreenhouseCalcRequest):
    """
    执行温室突变产出与收益计算
    """
    result = greenhouse_service.calculate_returns(
        mutation_id=req.mutation_id,
        farming_fortune=req.farming_fortune,
        greenhouse_upgrade=req.greenhouse_upgrade,
        unique_crops_bonus=req.unique_crops_bonus,
        positive_buff=req.positive_buff,
        negative_debuff=req.negative_debuff,
        has_immunity=req.has_immunity,
        evergreen_chip=req.evergreen_chip,
        multiplier=req.multiplier,
        mutations_count=req.mutations_count,
        custom_drops=req.custom_drops
    )
    return JSONResponse(result)

@app.get("/api/greenhouse/export")
def export_greenhouse_excel():
    """
    下载本地 master greenhouse_mutations.xlsx 文件
    """
    excel_file = os.path.join(BASE_DIR, "backend", "data", "greenhouse_mutations.xlsx")
    if os.path.exists(excel_file):
        return FileResponse(
            excel_file,
            filename="SkyBlock_Greenhouse_Mutations_v0.4.0.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    raise HTTPException(status_code=404, detail="温室突变 Excel 字典文件未找到")


# ==============================================================================
# 本地桌面端 / 便携版运行模式专有关停接口 (方式 2)
# 注意：在未来上线部署至公共网站服务器或微信小程序后端时，应将此接口移除或增加鉴权以防外部调用。
# ==============================================================================
@app.post("/api/server/shutdown")
def shutdown_server():
    """
    [本地桌面调试 / 便携版专用]
    允许前端网页通过界面按钮关停本地 FastAPI 服务进程，释放 8000 端口。
    """
    def _shutdown():
        time.sleep(0.5)  # 等待 HTTP 响应顺利返回给前端
        # 终止当前进程
        if sys.platform == "win32":
            os.kill(os.getpid(), signal.SIGTERM)
        else:
            os.kill(os.getpid(), signal.SIGINT)

    threading.Thread(target=_shutdown, daemon=True).start()
    return JSONResponse({
        "status": "success",
        "message": "本地后端服务正在安全退出，8000 端口已释放。您可以安全关闭当前浏览器标签页。"
    })

# Mount static files directory
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"status": "Server running", "message": "static/index.html is being prepared."})
