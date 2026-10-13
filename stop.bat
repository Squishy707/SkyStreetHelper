@echo off
chcp 65001 >nul
title Stop SkyStreetHelper Server
echo ============================================================
echo   SkyStreetHelper - Shutdown Script (alpha 0.4.1)
echo ============================================================
echo [INFO] Searching for processes listening on port 8000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [INFO] Found process PID: %%a, terminating...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [SUCCESS] Port 8000 released successfully. Local server stopped.
echo ============================================================
timeout /t 3 >nul
