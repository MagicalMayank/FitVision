@echo off
title Kinetic Oracle - Launch System
echo 🚀 Launching AI Backend...
start powershell -NoExit -Command "cd 'backend'; .\.venv\Scripts\Activate.ps1; python main.py"

echo 🎨 Launching PWA Frontend...
start powershell -NoExit -Command "cd 'frontend'; python -m http.server 3000"

echo.
echo ------------------------------------------------
echo System Active!
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:8000
echo ------------------------------------------------
echo.
pause