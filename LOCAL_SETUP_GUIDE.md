# 🚀 FitVision (Kinetic Oracle) - Local Setup & Commands Guide

This document contains the complete list of local terminal commands required to run, test, and manage the full-stack FitVision AI application.

---

## ⚡ 1-Click Fast Startup (Recommended)

You can launch the entire stack (Backend + Frontend + Ollama) by double-clicking:
```cmd
Start_Local_App.bat
```
*(or run `Start_FitVision_Remote.bat` if you also need Cloudflare remote tunnels for mobile access).*

---

## 💻 Manual Step-by-Step Commands

Open 3 separate terminal / PowerShell windows in the project directory (`c:\Users\mayan\My Coding\Kinetic Oracle`):

### 🔹 Terminal 1: Start Ollama LLM Service
```bash
# Project root directory
ollama serve
```

### 🔹 Terminal 2: Start Python AI Backend API (Port 8000)
```bash
cd backend
.\.venv\Scripts\activate
python main.py
```
*Backend URL: `http://localhost:8000`*
*Health Check: `http://localhost:8000/health`*

### 🔹 Terminal 3: Start PWA Frontend Server (Port 3000)
```bash
cd frontend
python -m http.server 3000
```
*Frontend URL: `http://localhost:3000/dashboard.html`*
*Signup Flow: `http://localhost:3000/signup.html`*

---

## 🌐 Optional: Enable Mobile Remote Access (Cloudflare Tunnels)

To test the application from your phone over HTTPS while using your laptop's GPU:

```bash
# Terminal 4: Backend Tunnel
.\cloudflared.exe tunnel --url http://localhost:8000

# Terminal 5: Frontend Tunnel
.\cloudflared.exe tunnel --url http://localhost:3000
```

---

## 🛑 How to Stop All Running Servers

To completely stop the frontend, backend, and Ollama services in one command:

```powershell
powershell -Command "Get-Process -Name python,ollama,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force"
```

---

## 📌 Main Local App URLs Summary

| Component | URL | Description |
| :--- | :--- | :--- |
| **Home Dashboard** | `http://localhost:3000/dashboard.html` | Performance hub & AI insights |
| **New 5-Step Signup** | `http://localhost:3000/signup.html` | Profile onboarding & body baseline |
| **Live AI Workout** | `http://localhost:3000/workout.html` | Real-time pose analysis & rep counter |
| **Backend Health** | `http://localhost:8000/health` | Status of YOLO, Ollama & models |
