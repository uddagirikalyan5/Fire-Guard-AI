@echo off
title FireGuard AI - Python Launcher
echo ========================================================
echo   FireGuard AI - Autonomous Fire Detection System
echo   Launching Python PySide6 Desktop Application...
echo ========================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10, 3.11, or 3.12 from python.org and check "Add Python to PATH".
    pause
    exit /b
)

if not exist "venv" (
    echo Creating virtual environment (venv)...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing / verifying dependencies...
pip install -r requirements.txt

echo.
echo Starting FireGuard AI...
python main.py

pause
