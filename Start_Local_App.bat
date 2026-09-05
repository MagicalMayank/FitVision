@echo off
title FitVision - Local Development Launcher
color 0A

echo ================================================================
echo          FITVISION AI SYSTEM - LOCAL LAUNCHER
echo ================================================================
echo.

echo 1/3 Starting Ollama AI Service...
start /b ollama serve >nul 2>&1

echo 2/3 Launching AI Backend Suite (Port 8000)...
start powershell -NoExit -Command "Set-Location '%~dp0backend'; .\.venv\Scripts\Activate.ps1; python main.py"

echo 3/3 Launching PWA Web Application (Port 3000)...
start powershell -NoExit -Command "Set-Location '%~dp0frontend'; python -m http.server 3000"

echo.
echo ================================================================
echo                  LOCAL ENVIRONMENT READY
echo ================================================================
echo Frontend Dashboard : http://localhost:3000/dashboard.html
echo Signup Flow        : http://localhost:3000/signup.html
echo Backend API        : http://localhost:8000/health
echo ================================================================
echo.
pause
