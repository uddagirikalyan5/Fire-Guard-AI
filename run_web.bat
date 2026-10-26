@echo off
title FireGuard AI - 100% Exact Web Preview Launcher
echo ========================================================
echo   FireGuard AI - Surveillance Console Launcher
echo   Launching 100%% Exact Google AI Studio Preview...
echo ========================================================
echo.

:: 1. Try launching with Python built-in server (Fastest, zero node dependencies)
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python detected! Launching Web Console via Python...
    python main.py --web
    pause
    exit /b
)

:: 2. If Python is not installed, try Node.js / Vite
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js detected! Starting Vite dev server...
    if not exist "node_modules" (
        echo Installing dependencies (npm install)...
        call npm install
    )
    call npm run dev
    pause
    exit /b
)

echo [ERROR] Neither Python nor Node.js was found in your system PATH!
echo Please install either:
echo 1) Python 3.10+ (from python.org with "Add Python to PATH") OR
echo 2) Node.js 18+ (from nodejs.org)
echo.
pause
