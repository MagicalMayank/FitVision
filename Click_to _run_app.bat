@echo off
title FitVision - Full-Stack AI Suite Launch System
color 0A

echo ================================================================
echo               FITVISION AI SYSTEM LAUNCHER
echo ================================================================
echo.

echo 1/3 Starting Local Ollama AI Service...
start /b ollama serve >nul 2>&1

echo 2/3 Launching AI Backend Suite (YOLO Pose + Food Seg + EfficientNet)...
start powershell -NoExit -Command "Set-Location '%~dp0backend'; .\.venv\Scripts\Activate.ps1; python main.py"

echo 3/3 Launching PWA Web Application...
start powershell -NoExit -Command "Set-Location '%~dp0frontend'; python -m http.server 3000"

echo.
echo ================================================================
echo                  SYSTEM FULLY ACTIVE ^& READY!
echo ================================================================
echo   Home Dashboard              : http://localhost:3000
echo   Live Workout ^& 3D Skeleton  : http://localhost:3000/workout.html
echo   Nutrition ^& AI Meal Scanner : http://localhost:3000/nutrition.html
echo   FastAPI Model Engine        : http://localhost:8000
echo ================================================================
echo.
echo Press any key to close this launcher window (services remain active).
pause >nul