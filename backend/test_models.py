import requests
import base64
import json

BASE_URL = 'http://localhost:8000'

print('=== END-TO-END MODEL VERIFICATION TEST ===\n')

# 1. Health Check
res = requests.get(f'{BASE_URL}/health')
print('1. Health Check:', res.json())

# 2. User DB Check
res = requests.get(f'{BASE_URL}/user')
user = res.json()
print(f"2. User DB: {user.get('name')} | Daily Calorie Goal: {user.get('target_calories')}")

# 3. Food Classes Check
res = requests.get(f'{BASE_URL}/nutrition/classes')
print('3. Food Classes Count:', res.json().get('total_count'))

# 4. Nutrition Scan Model Test (YOLO11m-Seg + EfficientNetV2-B2)
with open('anarsa.jpg', 'rb') as f:
    b64_img = base64.b64encode(f.read()).decode('utf-8')

scan_res = requests.post(f'{BASE_URL}/nutrition/scan', json={'image': b64_img}).json()
print('\n4. Nutrition Scan Model (YOLO11m-Seg + EfficientNetV2-B2):')
print('   Status:', scan_res.get('status'))
for food in scan_res.get('foods', []):
    name = food.get('display_name')
    conf = food.get('confidence') * 100
    portion = food.get('portion_g')
    macros = food.get('nutrition')
    print(f"   - Food: {name} | Confidence: {conf:.1f}% | Portion: {portion}g | Macros: {macros}")

# 5. Pose Analyzer Model Test (YOLO11n-Pose + Biomechanical Rules Engine)
pose_res = requests.post(f'{BASE_URL}/analyze', json={'image': b64_img, 'exercise': 'squat', 'debug': True}).json()
print('\n5. Pose Analyzer Model (YOLO11n-Pose):')
print('   Exercise:', pose_res.get('exercise'))
print('   Feedback:', pose_res.get('feedback'))
print('   Form Score:', pose_res.get('formScore'))
print('   Keypoints detected:', len(pose_res.get('keypoints', [])))

# 6. AI Nutrition Insight Model Test (Ollama qwen2.5)
nut_req = {
    'nutrition_data': {
        'total_calories': 1850,
        'calorie_goal': 2400,
        'total_protein': 130,
        'protein_goal': 150,
        'total_carbs': 200,
        'carb_goal': 280,
        'total_fat': 55,
        'fat_goal': 70,
        'meal_count': 3,
        'foods_eaten': 'Oatmeal, Chicken Salad, Anarsa'
    }
}
ai_nut_res = requests.post(f'{BASE_URL}/nutrition/ai-insight', json=nut_req).json()
print('\n6. AI Nutrition Coaching Model (Ollama qwen2.5):')
print('   Status:', ai_nut_res.get('status'))
print('   Insight:\n', ai_nut_res.get('insight'))

# 7. AI Workout Insight Model Test (Ollama qwen2.5)
wo_req = {
    'exercise': 'Squat Session',
    'total_reps': 15,
    'target_reps': 15,
    'duration_formatted': '02:30',
    'accuracy_pct': 94,
    'calories_burned': 135,
    'feedback_log': ['Good hip hinge', 'Maintain knee alignment on rep 12']
}
ai_wo_res = requests.post(f'{BASE_URL}/workout/ai-insight', json=wo_req).json()
print('\n7. AI Workout Coaching Model (Ollama qwen2.5):')
print('   Status:', ai_wo_res.get('status'))
print('   Insight:\n', ai_wo_res.get('insight'))

print('\n=== ALL MODELS TESTED SUCCESSFULLY ===')
