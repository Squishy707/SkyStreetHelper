"""
Launcher for SkyStreetHelper
Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator
Starts uvicorn ASGI server on port 8000 and automatically opens the browser
ONLY after Bazaar data has been fully loaded and server is responsive.
"""

import sys
import time
import threading
import webbrowser
import multiprocessing
import urllib.request

# Ensure stdout and stderr handle characters gracefully without UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import uvicorn

_browser_lock = threading.Lock()
_browser_opened = False

def open_browser():
    """
    等待后台 Bazaar 市场数据完全下载并完成计算后，
    再精准唤起系统默认浏览器访问 localhost:8000，防止网页过早弹出白屏或未加载数据。
    """
    global _browser_opened
    url = "http://localhost:8000"
    max_wait = 90  # 最多等待 90 秒
    start_time = time.time()
    
    print("\n[Launcher] 正在等待后台拉取 Hypixel Bazaar 实时数据并就绪本地服务...")

    while time.time() - start_time < max_wait:
        try:
            req = urllib.request.Request(
                f"{url}/api/bazaar", 
                headers={"User-Agent": "SkyStreetHelper-Launcher/0.4.1"}
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    time.sleep(0.4)  # 留出 400ms 确保前端静态资源准备完毕
                    with _browser_lock:
                        if not _browser_opened:
                            _browser_opened = True
                            print(f"\n[Browser] [OK] Bazaar 市场数据与本地服务已就绪！")
                            print(f"          正在自动为您唤起默认浏览器访问: {url}\n")
                            webbrowser.open(url)
                    return
        except Exception:
            pass
        time.sleep(0.6)

    # 超时保底打开
    with _browser_lock:
        if not _browser_opened:
            _browser_opened = True
            print(f"\n[Browser] 正在为您唤起默认浏览器访问: {url}")
            webbrowser.open(url)

if __name__ == "__main__":
    multiprocessing.freeze_support()

    print("=" * 72)
    print("  SkyStreetHelper - 独立便携版 (alpha 0.4.1)")
    print("  Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking")
    print("                           and Mutation Output Calculator")
    print("  - 本地服务地址: http://localhost:8000")
    print("  - 三大核心工具: 💎 宝石锻造套利 + 🧩 碎片属性追踪 + 🌱 农业突变产出与收益")
    print("  - 关停方式 1 (控制台): 在此窗口按 Ctrl + C 或直接点击右上角 [X] 关闭")
    print("  - 关停方式 2 (网页端): 在打开的网页右上角点击 [关闭服务] 按钮")
    print("=" * 72)

    # 启动后台守护线程，仅在服务端与数据就绪后唤起浏览器
    threading.Thread(target=open_browser, daemon=True).start()

    try:
        # 导入 FastAPI 应用实例并运行 uvicorn 服务器 (直接传入 app 实例以完美兼容 PyInstaller 打包单文件)
        from backend.app import app
        uvicorn.run(app, host="0.0.0.0", port=8000, reload=False, log_level="info")
    except KeyboardInterrupt:
        print("\n[Server] [OK] 接收到控制台终止信号 (Ctrl+C)，本地服务已安全退出。")
        sys.exit(0)
    except Exception as e:
        print(f"\n[Server Error] 服务异常退出: {e}")
        sys.exit(1)
