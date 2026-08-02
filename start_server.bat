@echo off
title YouTube Live Studio - Local Server
color 0A

echo ==========================================================
echo   YouTube Live Studio - Standalone Server Launcher
echo ==========================================================
echo.

cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Please install Python from https://www.python.org/
    pause
    exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
    echo [SETUP] Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
)

call venv\Scripts\activate.bat

echo [SETUP] Installing/updating dependencies...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies are up to date.

where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo.
    echo [WARNING] FFmpeg not found in PATH.
    echo           Streaming will NOT work without FFmpeg.
    echo           Download from: https://www.gyan.dev/ffmpeg/builds/
    echo.
)

for /f "skip=1 tokens=1 delims= " %%a in ('
    wmic nicconfig where "IPEnabled=True" get IPAddress ^| findstr /r "[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*"
') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip

set PORT=5000
set HOST=0.0.0.0

echo.
echo ==========================================================
echo   Server is starting...
echo.
echo   Local access:   http://localhost:%PORT%
echo   LAN access:     http://%LOCAL_IP%:%PORT%
echo.
echo   Open the URL above in your browser.
echo   Press Ctrl+C to stop the server.
echo ==========================================================
echo.

python app.py

echo.
echo [INFO] Server stopped.
pause
