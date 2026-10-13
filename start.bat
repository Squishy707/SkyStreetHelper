@echo off
chcp 65001 >nul
title SkyStreetHelper (alpha 0.4.1)
python run_server.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server exited with error code: %ERRORLEVEL%
    pause
)
