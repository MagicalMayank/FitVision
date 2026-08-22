from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pose_analyzer import analyzer
from food_analyzer import food_analyzer
from feedback_manager import feedback_manager
import db
import uvicorn
import requests
import json
import traceback

# Initialize DB on startup
db.init_db()

app = FastAPI()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FrameData(BaseModel):
    image: str # Base64 encoded image string
    exercise: str = "squat"
    debug: bool = False

class MealScanRequest(BaseModel):
    image: str  # Base64 encoded image

class PortionUpdate(BaseModel):
    food_index: int
    portion_g: int

class FeedbackRequest(BaseModel):
    image: str = None  # Base64 image or crop
    predicted_class: str = "unknown"
    corrected_class: str
    portion_g: int = 150
    bbox: dict = None
    nutrition_per_100g: dict = None  # Optional custom macros per 100g

class AIInsightRequest(BaseModel):
    nutrition_data: dict  # Today's nutrition totals and meals
    workout_data: dict = None  # Optional workout context

class WorkoutSessionInsightRequest(BaseModel):
    exercise: str = "Squat Session"
    total_reps: int = 15
    target_reps: int = 15
    duration_formatted: str = "02:30"
    accuracy_pct: int = 92
    calories_burned: int = 120
    feedback_log: list = []

@app.post("/analyze")
async def analyze_frame(data: FrameData):
    try:
        result = analyzer.analyze(data.image, exercise=data.exercise, debug=data.debug)
        return result
    except Exception as e:
        print(f"Error analyzing frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/biomechanics/config")
async def get_biomechanics_config():
    return analyzer.config

@app.post("/biomechanics/config")
async def update_biomechanics_config(new_config: dict):
    analyzer.update_config(new_config)
    return {"status": "updated", "config": analyzer.config}

@app.post("/biomechanics/reset")
async def reset_biomechanics(exercise: str = None):
    analyzer.reset_exercise(exercise)
    return {"status": "reset", "exercise": exercise or "all"}

@app.post("/nutrition/scan")
async def scan_meal(data: MealScanRequest):
    """Scan a meal image through the full ML pipeline."""
    try:
        result = food_analyzer.analyze(data.image)
        return result
    except Exception as e:
        print(f"Error scanning meal: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/nutrition/ai-insight")
async def get_ai_insight(data: AIInsightRequest):
    """
    Send structured nutrition + workout data to local Ollama (qwen2.5:7b).
    Qwen explains/coaches — never calculates or invents nutrition values.
    """
    try:
        nutrition = data.nutrition_data
        workout = data.workout_data or {}

        prompt = f"""You are a sports nutritionist AI coach for a fitness app called "Kinetic Oracle". 
You are given the user's REAL nutrition and workout data for today. Your job is to:
1. Analyze their nutritional intake relative to their goals
2. Provide coaching advice on what to eat next
3. Flag any deficiencies or excesses
4. Suggest recovery strategies if workout data is available

IMPORTANT RULES:
- NEVER invent, calculate, or estimate any nutritional values. All numbers are pre-calculated.
- Only reference the exact numbers provided below.
- Keep your response concise (3-4 sentences max).
- Be motivational but honest.
- Speak directly to the user using "you/your".

TODAY'S NUTRITION DATA:
- Total Calories: {nutrition.get('total_calories', 0)} / {nutrition.get('calorie_goal', 2400)} kcal
- Protein: {nutrition.get('total_protein', 0)}g / {nutrition.get('protein_goal', 150)}g
- Carbs: {nutrition.get('total_carbs', 0)}g / {nutrition.get('carb_goal', 280)}g
- Fat: {nutrition.get('total_fat', 0)}g / {nutrition.get('fat_goal', 70)}g
- Meals logged: {nutrition.get('meal_count', 0)}
- Foods eaten: {nutrition.get('foods_eaten', 'None logged yet')}

WORKOUT DATA:
- Type: {workout.get('type', 'Not recorded')}
- Duration: {workout.get('duration', 'N/A')}
- Intensity: {workout.get('intensity', 'N/A')}
- Reps completed: {workout.get('reps', 'N/A')}

Provide your coaching insight:"""

        # Call local Ollama with fallback models
        models_to_try = ["qwen2.5:7b", "qwen2.5:latest", "qwen2.5:1.5b"]
        insight_text = None

        for model_name in models_to_try:
            try:
                ollama_response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": 180
                        }
                    },
                    timeout=35
                )

                if ollama_response.status_code == 200:
                    result = ollama_response.json()
                    insight_text = result.get("response", "").strip()
                    if insight_text:
                        break
            except Exception as e:
                print(f"[Ollama] Model {model_name} failed: {e}")
                continue

        if insight_text:
            return {
                "insight": insight_text,
                "status": "success"
            }
        else:
            return {
                "insight": "AI coaching is currently processing. Keep tracking your meals!",
                "status": "ollama_error"
            }

    except requests.exceptions.ConnectionError:
        return {
            "insight": "AI coaching requires Ollama running locally. Start Ollama with 'ollama serve' and pull 'qwen2.5:7b'.",
            "status": "ollama_offline"
        }
    except Exception as e:
        print(f"Error getting AI insight: {e}")
        traceback.print_exc()
        return {
            "insight": "Unable to generate insight at this time. Keep tracking your meals!",
            "status": "error",
            "detail": str(e)
        }

@app.post("/workout/ai-insight")
async def get_workout_ai_insight(data: WorkoutSessionInsightRequest):
    """
    Generate personalized AI coaching insights for completed workout session using local Ollama qwen2.5:7b.
    """
    try:
        notes = ", ".join(data.feedback_log) if data.feedback_log else "Clean form execution with steady tempo."
        prompt = f"""You are Kinetic AI, an elite strength conditioning and biomechanics sports coach.
Analyze this athlete's workout session and provide 2 distinct, concise coaching insights (1 recommendation for form/tempo improvement, 1 praise/personal record note).

WORKOUT SUMMARY:
- Exercise: {data.exercise}
- Completed Reps: {data.total_reps} / Target Reps: {data.target_reps}
- Duration: {data.duration_formatted}
- Form Accuracy: {data.accuracy_pct}%
- Estimated Energy: {data.calories_burned} kcal
- Posture Notes: {notes}

FORMAT YOUR RESPONSE IN EXACTLY TWO BULLETS:
1. RECOMMENDATION: <1-2 sentences on form, tempo, or depth improvement>
2. HIGHLIGHT: <1-2 sentences praising performance or progress>
Keep it concise, high-energy, and scientific. No conversational filler."""

        models_to_try = ["qwen2.5:7b", "qwen2.5:latest", "qwen2.5:1.5b"]
        insight_text = None

        for model_name in models_to_try:
            try:
                ollama_response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": 180
                        }
                    },
                    timeout=30
                )

                if ollama_response.status_code == 200:
                    res = ollama_response.json()
                    insight_text = res.get("response", "").strip()
                    if insight_text:
                        break
            except Exception as e:
                print(f"[Ollama Workout] Model {model_name} failed: {e}")
                continue

        if insight_text:
            return {"insight": insight_text, "status": "success"}
        else:
            return {
                "insight": "1. RECOMMENDATION: Maintain a controlled 3-second eccentric phase to maximize muscle hypertrophy.\n2. HIGHLIGHT: Outstanding form precision! Output consistency remained high throughout all reps.",
                "status": "fallback"
            }
    except requests.exceptions.ConnectionError:
        return {
            "insight": "1. RECOMMENDATION: Focus on full depth and knee stability during bottom phase of movement.\n2. HIGHLIGHT: Elite form precision achieved! (Start Ollama with 'ollama serve' to activate live AI coaching)",
            "status": "ollama_offline"
        }
    except Exception as e:
        print(f"Error generating workout AI insight: {e}")
        return {
            "insight": "1. RECOMMENDATION: Keep back straight and core engaged on every repetition.\n2. HIGHLIGHT: Strong session completion!",
            "status": "error"
        }

@app.get("/nutrition/classes")
async def get_food_classes():
    """Return all available food classes (80 standard + registered custom classes)."""
    try:
        classes = food_analyzer.get_all_classes()
        return {"classes": classes, "total_count": len(classes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/nutrition/feedback")
async def submit_food_feedback(data: FeedbackRequest):
    """
    Save user feedback/correction on meal identification for model fine-tuning dataset,
    register custom food classes, and return recalculated nutrition.
    """
    try:
        # Save feedback dataset entry & register custom class if applicable
        res = feedback_manager.save_feedback(
            b64_image=data.image,
            predicted_class=data.predicted_class,
            corrected_class=data.corrected_class,
            portion_g=data.portion_g,
            bbox=data.bbox,
            nutrition_per_100g=data.nutrition_per_100g
        )

        # Lookup nutrition for the corrected food
        nutrition_entry = food_analyzer.lookup_nutrition(data.corrected_class)

        nutrition = {}
        if nutrition_entry:
            n100 = nutrition_entry["nutrition_per_100g"]
            scale = data.portion_g / 100.0
            nutrition = {
                "calories": round(n100["calories"] * scale),
                "protein_g": round(n100["protein_g"] * scale, 1),
                "carbs_g": round(n100["carbs_g"] * scale, 1),
                "fat_g": round(n100["fat_g"] * scale, 1)
            }
        else:
            # Fallback average if unspecified
            scale = data.portion_g / 100.0
            nutrition = {
                "calories": round(200 * scale),
                "protein_g": round(8 * scale, 1),
                "carbs_g": round(25 * scale, 1),
                "fat_g": round(7 * scale, 1)
            }

        return {
            "status": "success",
            "feedback_id": res["feedback_id"],
            "corrected_class": data.corrected_class,
            "display_name": data.corrected_class.replace("_", " ").title(),
            "is_new_class": res["is_new_class"],
            "portion_g": data.portion_g,
            "nutrition": nutrition,
            "message": f"Feedback recorded! Updated '{data.corrected_class}' in AI model dataset."
        }
    except Exception as e:
        print(f"Error saving feedback: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user")
async def get_user_profile():
    user = db.get_user()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
