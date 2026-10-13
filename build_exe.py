"""
PyInstaller Build Helper Script
Packages SkyStreetHelper (Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator)
into a standalone executable (Windows .exe).

Usage:
1. pip install pyinstaller
2. python build_exe.py
"""

import os
import subprocess
import sys

from datetime import datetime

def build():
    version = "0.4.1"
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    exe_name = f"SkyStreetHelper_{version}_{timestamp}"

    print("============================================================")
    print(f"  SkyStreetHelper (alpha {version}) - 单文件独立可执行程序打包器")
    print("  Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator")
    print(f"  目标文件名: {exe_name}.exe")
    print("============================================================")
    
    # Check PyInstaller
    try:
        import PyInstaller
        print("[1/3] 检测到已安装 PyInstaller:", PyInstaller.__version__)
    except ImportError:
        print("[!] 未检测到 PyInstaller，正在自动安装...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    print("[2/3] 正在启动 PyInstaller 进行单文件 (--onefile) 打包...")
    
    # PyInstaller arguments for standalone single-file execution
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",  # 单文件绿色便携版
        f"--name={exe_name}",
        "--add-data=static;static",
        "--add-data=gemflipper.xlsx;.",
        "--add-data=backend/data;backend/data",
        "--add-data=backend/shard_data.json;backend",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=fastapi",
        "--hidden-import=fastapi.staticfiles",
        "--hidden-import=fastapi.responses",
        "--hidden-import=fastapi.middleware.cors",
        "--hidden-import=starlette",
        "--hidden-import=starlette.staticfiles",
        "--hidden-import=starlette.responses",
        "--hidden-import=starlette.middleware",
        "--hidden-import=starlette.middleware.cors",
        "--hidden-import=starlette.routing",
        "--hidden-import=pydantic",
        "--hidden-import=openpyxl",
        "--hidden-import=requests",
        "--hidden-import=numpy",
        "--hidden-import=backend",
        "--hidden-import=backend.app",
        "--hidden-import=backend.bazaar_service",
        "--hidden-import=backend.event_service",
        "--hidden-import=backend.price_tracker",
        "--hidden-import=backend.flipper_engine",
        "--hidden-import=backend.profile_service",
        "--hidden-import=backend.shard_service",
        "--hidden-import=backend.greenhouse_service",
        "run_server.py"
    ]
    
    print("执行命令:\n", " ".join(cmd), "\n")
    subprocess.check_call(cmd)
    
    dist_file = os.path.join("dist", f"{exe_name}.exe")
    clean_dist_file = os.path.join("dist", f"SkyStreetHelper_{version}.exe")
    import shutil
    if os.path.exists(dist_file):
        try:
            shutil.copy2(dist_file, clean_dist_file)
        except Exception:
            pass
    print("\n[3/3] 打包流程圆满完成！")
    if os.path.exists(dist_file):
        size_mb = os.path.getsize(dist_file) / (1024 * 1024)
        print(f"[SUCCESS] 生成的单文件可执行程序: {dist_file} ({size_mb:.2f} MB)")
        print(f"[INFO] 另存为独立文件，未覆盖历史版本。")
        print("       无需安装 Python 或任何依赖，双击即可直接运行并自动弹出浏览器！")

if __name__ == "__main__":
    build()
