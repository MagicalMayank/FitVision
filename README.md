<p align="center">
  <img src="frontend/FV%20icon.png" width="130" alt="FitVision Brand Logo">
  <h1 align="center">FitVision</h1>
  <p align="center">
    <strong>AI-Powered Real-Time Biomechanical Workout Coach & Nutrition Intelligence Platform</strong>
  </p>
</p>

FitVision (*formerly Kinetic Oracle*) is a state-of-the-art PWA (Progressive Web Application) designed to deliver real-time pose tracking, AI form correction, interactive 3D biomechanics, intelligent nutrition scoring, and a full-featured fitness store—all powered by computer vision and local AI models.

---

<p align="center">
  <img src="frontend/upscaled%20Man%20image.png" width="450" alt="FitVision Mobile Hero" style="border-radius: 12px;">
</p>

---

## 🌟 Key Features

### 🏋️ 1. Real-Time Biomechanical Pose Analysis
- **17-Point Skeletal Tracking**: Uses **YOLO11-Pose** to track key body joints (shoulders, elbows, hips, knees, ankles) via live webcam or mobile video feeds.
- **Form Defect Detection**: Calculates real-time joint angles to detect depth issues, spinal rounding, knee valgus, or asymmetry.
- **Precision Rep Counting**: State-machine rep tracking with hysteresis thresholds for accurate squat, push-up, and deadlift repetition counts.

<p align="left">
  <img src="frontend/squat%20icon.png" width="80" alt="Biomechanical Squat Icon">
</p>

### 🦴 2. Interactive 3D Skeleton & Voice Coach
- **3D Biomechanical Render**: Canvas-rendered 3D skeletal overlay (`Three.js` integration) mirroring movement patterns in real-time.
- **Adaptive Voice Coach**: Spoken audio cues providing immediate corrective feedback during active sets (e.g., *"Keep your chest up"*, *"Push hips back"*).

<p align="left">
  <img src="frontend/muscleMap.svg" width="220" alt="3D Muscle Heatmap Visual">
</p>

### 🥗 3. Nutrition & Recovery Intelligence
- **Multi-Segment Macro Donut**: Decomposes daily recovery into 4 color-coded macro segments (Protein, Hydration, Carbs, Calories).
- **AI Meal Scanner & Indian Food DB**: Powered by **EfficientNet-B2** and an extensive Indian food nutrition database to log meals instantly from photos.
- **Daily Recovery Score**: Weighted algorithm calculating daily readiness and target protein gaps.

### 🛍️ 4. FitVision E-Commerce Store
- **Local Product Catalog**: Browse items across 6 categories: **Protein**, **Snacks**, **Supplements**, **Home Gym**, **Dumbbells**, and **Wearables**.
- **Interactive Filtering & Search**: Instant category chip selection and real-time live search by brand, title, or keywords.
- **Cart & Checkout**: Persistent cart storage, overlapping neon yellow circular badges, discount calculation, and simulated checkout flow.

| Category | Product Image | Featured Product |
| :--- | :---: | :--- |
| **Protein** | <img src="frontend/Products/Protein/Muscle%20Blaze%20Gold%20100%25%20Whey.png" width="85" alt="Protein"> | **MuscleBlaze** Biozyme Gold 100% Whey |
| **Home Gym** | <img src="frontend/Products/Home%20Gym/Flexnest%20Flexbike%20Plus.webp" width="85" alt="Home Gym"> | **Flexnest** Flexbike Plus HD Touchscreen |
| **Wearables** | <img src="frontend/Products/Wearables/Amazefit%20Helio%20Strap.jpg" width="85" alt="Wearables"> | **Amazfit** Helio Smart Fitness Ring |
| **Snacks** | <img src="frontend/Products/Snacks/The%20whole%20truth%20All%20in%20one%20protein%20bar.webp" width="85" alt="Snacks"> | **The Whole Truth** Clean Protein Bar |

### 🎨 5. Modern Brand Identity & Dark Mode Aesthetic
- **Signature Styling**: High-contrast dark theme (`#131313`) paired with high-energy neon yellow accents (`#F5FF00`).
- **Standardized Branding**: Clean geometric `Space Grotesk` & `Manrope` typography with left-aligned **FitVision** logo casing.

---

## 🛠️ Tech Stack & Architecture

```
                               ┌──────────────────────────────────┐
                               │     FitVision Frontend (PWA)     │
                               │  HTML5 • Vanilla CSS • JavaScript │
                               └────────────────┬─────────────────┘
                                                │ REST / WebSocket
                               ┌────────────────▼─────────────────┐
                               │      FastAPI Python Backend      │
                               └────────┬─────────────────┬───────┘
                                        │                 │
              ┌─────────────────────────▼──┐           ┌──▼─────────────────────────┐
              │  Computer Vision Models    │           │     Local Ollama AI        │
              │  • YOLO11-Pose (Webcam)    │           │  • LLM Coaching Insights   │
              │  • EfficientNet-B2 (Food)  │           │  • Voice Feedback Library  │
              └────────────────────────────┘           └────────────────────────────┘
```

- **Frontend**: Vanilla HTML5, Vanilla CSS3 (CSS Variables, Flexbox/Grid), JavaScript (ES6+), PWA Service Worker.
- **Backend API**: Python 3.12, FastAPI, Uvicorn, OpenCV, PyTorch, SQLite.
- **AI Models**: Ultralytics YOLO11-Pose, EfficientNet-B2, Ollama LLM.
- **Tunneling**: Cloudflare Tunnels (`cloudflared.exe`) for remote mobile HTTPS access.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: 3.10 or higher
- **Node.js** or a simple HTTP server (optional for serving frontend static files)
- **Webcam**: Built-in or USB webcam for live pose analysis

---

### ⚡ One-Click Startup (Windows)

Choose one of the included batch scripts to launch the application:

1. **Local Mode**:
   Double-click `Start_Local_App.bat` or `Click_to _run_app.bat` to launch backend and frontend servers locally on `http://localhost:3000`.

2. **Remote Mobile Mode**:
   Double-click `Start_FitVision_Remote.bat` to start Ollama, local backend, local frontend, and generate public Cloudflare HTTPS links for mobile device access.

---

### 🔧 Manual Setup

#### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI Server
python main.py
```
The API server will run at `http://localhost:8000`.

#### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Serve frontend using any static HTTP server (e.g., Python built-in)
python -m http.server 3000
```
Open `http://localhost:3000` in your web browser.

---

## 📁 Folder Structure

```
Kinetic Oracle / FitVision/
├── backend/                        # Python FastAPI Backend Engine
│   ├── main.py                     # Primary API Routes & WebSocket endpoints
│   ├── pose_analyzer.py            # YOLO11-Pose frame processing & angle calculation
│   ├── food_analyzer.py            # EfficientNet-B2 Indian food classification
│   ├── biomechanical_rules.py      # Exercise rules, rep state-machines & form logic
│   ├── db.py                       # SQLite database helpers
│   ├── requirements.txt            # Python dependencies
│   └── models/                     # PyTorch & YOLO model weights (.pt / .pth)
│
├── frontend/                       # Progressive Web App (PWA) Frontend
│   ├── index.html / dashboard.html # Home Dashboard & My Week activity strip
│   ├── workout.html                # Live webcam workout & 3D skeleton view
│   ├── nutrition.html              # Recovery score & meal scanner
│   ├── shop.html                   # FitVision Store with category filtering
│   ├── cart.html                   # Shopping cart & checkout flow
│   ├── profile.html                # User profile & settings
│   ├── onboarding.html             # First-time onboarding flow
│   ├── splash.html                 # Animated splash screen
│   ├── FV icon.png                 # Primary FitVision logo asset
│   ├── upscaled Man image.png      # Onboarding hero image asset
│   ├── squat icon.png              # Exercise biomechanics icon
│   ├── muscleMap.svg               # 3D muscle heatmap vector
│   ├── css/
│   │   └── styles.css              # Unified FitVision design system & CSS variables
│   ├── js/
│   │   ├── app.js                  # Main application initializer & route handler
│   │   ├── shop.js                 # Store dataset, category filter & search logic
│   │   ├── camera.js               # WebRTC camera pipeline
│   │   ├── repCounter.js           # Frontend rep detection consumer
│   │   └── voiceCoach.js           # Text-to-speech audio cue engine
│   └── Products/                   # Product catalog images by category
│
├── Click_to _run_app.bat           # One-click app launcher
├── Start_Local_App.bat             # Local dev environment launcher
└── Start_FitVision_Remote.bat      # Remote access Cloudflare tunnel launcher
```

---

## 📱 Navigation Overview

| Page | Description |
| :--- | :--- |
| **Home (`dashboard.html`)** | Overview of daily workout quote, **MY WEEK** activity strip, quick start actions, and recent session summary. |
| **Workout (`workout.html`)** | Live camera view, real-time pose tracking, 3D skeleton overlay, reps counter, and voice coach controls. |
| **Nutrition (`nutrition.html`)** | 4-segment macro donut chart, overall recovery score, meal photo scanner, and Indian food database lookup. |
| **Shop (`shop.html`)** | Interactive store with category chips (**Protein**, **Snacks**, **Supplements**, **Home Gym**, **Dumbbells**, **Wearables**), live search, and sorting. |
| **Cart (`cart.html`)** | Itemized shopping cart, subtotal/discount breakdown, and order checkout modal. |
| **Profile (`profile.html`)** | User fitness stats, streak counters, theme toggling, and sub-pages for account settings. |

---

## 🔒 Privacy & Safety

FitVision processes video streams **locally on your device**. Live camera frames are analyzed in memory using local computer vision models and are never permanently recorded or transmitted to third-party cloud servers.

---

## 📄 License & Acknowledgments

Designed & Developed for **FitVision**. Built using open-source technologies including OpenCV, PyTorch, Ultralytics YOLO11, FastAPI, and Google Material Symbols.
