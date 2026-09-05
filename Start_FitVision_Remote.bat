@echo off
title FitVision - Remote PWA Cloudflare Tunnel Launcher
color 0B

echo ================================================================
echo          FITVISION AI SYSTEM - REMOTE TUNNEL LAUNCHER
echo ================================================================
echo.

echo 1/4 Starting Local Ollama AI Service...
start /b ollama serve >nul 2>&1

echo 2/4 Launching AI Backend Suite (YOLO Pose + Food Seg + EfficientNet)...
start powershell -NoExit -Command "Set-Location '%~dp0backend'; .\.venv\Scripts\Activate.ps1; python main.py"

echo 3/4 Launching PWA Web Application (Port 3000)...
start powershell -NoExit -Command "Set-Location '%~dp0frontend'; python -m http.server 3000"

echo 4/4 Starting Cloudflare Tunnels...
echo.
echo Launching Frontend Tunnel...
start powershell -NoExit -Command ".\cloudflared.exe tunnel --url http://localhost:3000"

echo Launching Backend API Tunnel...
start powershell -NoExit -Command ".\cloudflared.exe tunnel --url http://localhost:8000"

echo.
echo ================================================================
echo                  TUNNELS INITIATED
echo ================================================================
echo Look at the two new PowerShell windows running Cloudflare Tunnels.
echo 1. Copy the backend API URL (e.g. https://xyz.trycloudflare.com)
echo 2. Paste it into frontend/js/app.js under window.CLOUDFLARE_API_URL
echo 3. Open the frontend URL on your phone to use the app!
echo ================================================================
echo.
pause >nul
