"""
Food Analyzer Pipeline for Kinetic Oracle
------------------------------------------
Image → YOLO11m-Seg (best.pt) → food crop & segmentation
→ EfficientNetV2-B2 (best_efficientnet_b2_indian_food.pth) → food identification
→ indian_food_nutrition_db.json → portion estimate → deterministic calories/macros
"""

import cv2
import numpy as np
import base64
import json
import os
import torch
import torch.nn.functional as F
from torchvision import transforms
import timm
from ultralytics import YOLO
from difflib import SequenceMatcher
from feedback_manager import feedback_manager

# --- Constants ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
YOLO_MODEL_PATH = os.path.join(SCRIPT_DIR, "best.pt")
EFFNET_MODEL_PATH = os.path.join(SCRIPT_DIR, "best_efficientnet_b2_indian_food.pth")
NUTRITION_DB_PATH = os.path.join(SCRIPT_DIR, "indian_food_nutrition_db.json")

# 80 Indian food classes — must match training order exactly
CLASS_NAMES = [
    "adhirasam", "aloo_gobi", "aloo_matar", "aloo_methi", "aloo_shimla_mirch",
    "aloo_tikki", "anarsa", "ariselu", "bandar_laddu", "basundi",
    "bhatura", "bhindi_masala", "biryani", "boondi", "butter_chicken",
    "chak_hao_kheer", "cham_cham", "chana_masala", "chapati", "chhena_kheeri",
    "chicken_razala", "chicken_tikka", "chicken_tikka_masala", "chikki", "daal_baati_churma",
    "daal_puri", "dal_makhani", "dal_tadka", "dharwad_pedha", "doodhpak",
    "double_ka_meetha", "dum_aloo", "gajar_ka_halwa", "gavvalu", "ghevar",
    "gulab_jamun", "imarti", "jalebi", "kachori", "kadai_paneer",
    "kadhi_pakoda", "kajjikaya", "kakinada_khaja", "kalakand", "karela_bharta",
    "kofta", "kuzhi_paniyaram", "lassi", "ledikeni", "litti_chokha",
    "lyangcha", "maach_jhol", "makki_di_roti_sarson_da_saag", "malapua", "misi_roti",
    "misti_doi", "modak", "mysore_pak", "naan", "navrattan_korma",
    "palak_paneer", "paneer_butter_masala", "phirni", "pithe", "poha",
    "poornalu", "pootharekulu", "qubani_ka_meetha", "rabri", "ras_malai",
    "rasgulla", "sandesh", "shankarpali", "sheera", "sheer_korma",
    "shrikhand", "sohan_halwa", "sohan_papdi", "sutar_feni", "unni_appam"
]

# Default portion sizes in grams for common food types
DEFAULT_PORTIONS = {
    "sweet": 50, "curry": 150, "bread": 80, "rice": 200,
    "snack": 100, "beverage": 200, "breakfast": 150, "combo": 200,
    "starter": 120
}

# Confidence threshold
MIN_CONFIDENCE = 0.15

class FoodAnalyzer:
    def __init__(self):
        self._yolo = None
        self._effnet = None
        self._nutrition_db = None
        self._nutrition_map = None
        self._device = torch.device("cpu")
        self._transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((260, 260)),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225])
        ])

    @property
    def yolo(self):
        if self._yolo is None:
            print("[FoodAnalyzer] Loading YOLO segmentation model...")
            self._yolo = YOLO(YOLO_MODEL_PATH)
            print("[FoodAnalyzer] YOLO model loaded.")
        return self._yolo

    @property
    def effnet(self):
        if self._effnet is None:
            print("[FoodAnalyzer] Loading EfficientNet-B2 classifier (timm)...")
            model = timm.create_model('efficientnet_b2', pretrained=False, num_classes=len(CLASS_NAMES))
            # Load trained weights (checkpoint is a raw state_dict OrderedDict)
            state_dict = torch.load(EFFNET_MODEL_PATH, map_location=self._device, weights_only=False)
            # Handle wrapped checkpoint formats
            if isinstance(state_dict, dict) and 'model_state_dict' in state_dict:
                state_dict = state_dict['model_state_dict']
            elif isinstance(state_dict, dict) and 'state_dict' in state_dict:
                state_dict = state_dict['state_dict']
            model.load_state_dict(state_dict, strict=True)
            model.eval()
            model.to(self._device)
            self._effnet = model
            print("[FoodAnalyzer] EfficientNet model loaded successfully.")
        return self._effnet

    @property
    def nutrition_db(self):
        if self._nutrition_db is None:
            with open(NUTRITION_DB_PATH, "r", encoding="utf-8") as f:
                self._nutrition_db = json.load(f)
            # Build lookup map: dish_name -> entry (with aliases)
            self._nutrition_map = {}
            for entry in self._nutrition_db:
                name = entry["dish_name"].lower().strip()
                self._nutrition_map[name] = entry
                # Also index by IFCT/USDA mappings as aliases
                for alias in entry.get("mappings", {}).values():
                    alias_key = alias.lower().strip().replace(" ", "_")
                    if alias_key not in self._nutrition_map:
                        self._nutrition_map[alias_key] = entry
            print(f"[FoodAnalyzer] Nutrition DB loaded: {len(self._nutrition_db)} entries.")
        return self._nutrition_db

    @property
    def nutrition_map(self):
        # Ensure DB is loaded first
        _ = self.nutrition_db
        return self._nutrition_map

    def base64_to_img(self, b64_string):
        """Convert base64 image string to OpenCV BGR image."""
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        img_data = base64.b64decode(b64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img

    def img_to_base64(self, img):
        """Convert OpenCV BGR image to base64 JPEG string."""
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

    def lookup_nutrition(self, dish_name):
        """Look up nutrition info from DB + custom classes registry with fuzzy matching fallback."""
        if not dish_name:
            return None

        key = dish_name.lower().strip().replace(" ", "_")

        # 1. Check custom registered classes
        custom_classes = feedback_manager.get_custom_classes()
        if key in custom_classes:
            return custom_classes[key]

        # 2. Exact match in built-in nutrition map
        if key in self.nutrition_map:
            return self.nutrition_map[key]

        # 3. Fuzzy match — find best match above threshold
        best_score = 0
        best_entry = None
        for db_name, entry in self.nutrition_map.items():
            score = SequenceMatcher(None, key, db_name).ratio()
            if score > best_score:
                best_score = score
                best_entry = entry

        if best_score >= 0.6:
            return best_entry

        return None

    def get_all_classes(self):
        """Return combined list of all 80 standard classes + custom registered classes."""
        built_in = [
            {
                "key": c,
                "display_name": c.replace("_", " ").title(),
                "is_custom": False,
                "nutrition_per_100g": self.lookup_nutrition(c).get("nutrition_per_100g") if self.lookup_nutrition(c) else None
            }
            for c in CLASS_NAMES
        ]

        custom_map = feedback_manager.get_custom_classes()
        custom = [
            {
                "key": k,
                "display_name": v.get("dish_name", k.replace("_", " ").title()),
                "is_custom": True,
                "nutrition_per_100g": v.get("nutrition_per_100g")
            }
            for k, v in custom_map.items()
            if k not in CLASS_NAMES
        ]

        return built_in + custom

    def estimate_portion(self, mask_area, image_area, category="curry"):
        """Estimate portion in grams based on mask area relative to image."""
        base = DEFAULT_PORTIONS.get(category, 100)
        # Scale by relative area (assume full plate ~40% of image)
        ratio = mask_area / max(image_area * 0.4, 1)
        portion = base * min(max(ratio, 0.3), 2.5)
        return round(portion / 5) * 5  # Round to nearest 5g

    def classify_crop(self, crop_bgr):
        """Run EfficientNetV2-B2 on a food crop, return (class_name, confidence)."""
        if crop_bgr is None or crop_bgr.size == 0:
            return None, 0.0
        crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        tensor = self._transform(crop_rgb).unsqueeze(0).to(self._device)
        with torch.no_grad():
            logits = self.effnet(tensor)
            probs = F.softmax(logits, dim=1)
            conf, idx = probs.max(dim=1)
        class_name = CLASS_NAMES[idx.item()]
        return class_name, conf.item()

    def analyze(self, b64_image):
        """
        Full pipeline: base64 image → YOLO segment → EfficientNet classify
        → nutrition DB lookup → portion estimation → results.
        """
        img = self.base64_to_img(b64_image)
        if img is None:
            return {"error": "Failed to decode image", "foods": [], "scan_image": None}

        h, w = img.shape[:2]
        image_area = h * w

        # Step 1: YOLO Segmentation
        results = self.yolo(img, verbose=False, conf=0.25)

        if not results or len(results[0].boxes) == 0:
            return {
                "foods": [],
                "scan_image": self.img_to_base64(img),
                "message": "No food items detected. Try capturing a clearer image.",
                "status": "no_food"
            }

        result = results[0]
        boxes = result.boxes
        masks = result.masks

        foods = []
        scan_img = img.copy()
        food_regions = []

        for i in range(len(boxes)):
            box = boxes[i]
            yolo_class_id = int(box.cls[0])
            yolo_conf = float(box.data[0][4])
            yolo_label = self.yolo.names.get(yolo_class_id, "unknown")

            # Get bounding box
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)

            if (x2 - x1) < 20 or (y2 - y1) < 20:
                continue

            # Get mask area
            mask_area = 0
            if masks is not None and i < len(masks.data):
                mask = masks.data[i].cpu().numpy()
                mask_resized = cv2.resize(mask, (w, h))
                mask_area = np.sum(mask_resized > 0.5)

                # Draw segmentation overlay
                colored_mask = np.zeros_like(scan_img)
                colored_mask[mask_resized > 0.5] = [0, 245, 245]  # Yellow-ish
                scan_img = cv2.addWeighted(scan_img, 1, colored_mask, 0.25, 0)

            # Crop the detected region
            crop = img[y1:y2, x1:x2]

            # Step 2: EfficientNet Classification
            class_name, effnet_conf = self.classify_crop(crop)

            # Step 3: Nutrition DB Lookup
            nutrition_entry = self.lookup_nutrition(class_name) if class_name else None
            db_match = nutrition_entry is not None

            # Step 4: Portion estimation
            category = nutrition_entry.get("category", "curry") if nutrition_entry else "curry"
            portion_g = self.estimate_portion(mask_area if mask_area > 0 else (x2-x1)*(y2-y1), image_area, category)

            # Step 5: Calculate deterministic nutrition
            nutrition = {}
            if nutrition_entry:
                n100 = nutrition_entry["nutrition_per_100g"]
                scale = portion_g / 100.0
                nutrition = {
                    "calories": round(n100["calories"] * scale),
                    "protein_g": round(n100["protein_g"] * scale, 1),
                    "carbs_g": round(n100["carbs_g"] * scale, 1),
                    "fat_g": round(n100["fat_g"] * scale, 1)
                }

            # Determine confidence level
            if effnet_conf < MIN_CONFIDENCE:
                confidence_level = "low"
            elif effnet_conf < 0.5:
                confidence_level = "medium"
            else:
                confidence_level = "high"

            # Draw bounding box on scan image
            color = (0, 255, 245) if confidence_level != "low" else (0, 100, 255)
            cv2.rectangle(scan_img, (x1, y1), (x2, y2), color, 2)
            display_name = class_name.replace("_", " ").title() if class_name else yolo_label
            label_text = f"{display_name} ({effnet_conf*100:.0f}%)"
            cv2.putText(scan_img, label_text, (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)

            food_item = {
                "id": i,
                "class_name": class_name,
                "display_name": display_name,
                "yolo_label": yolo_label,
                "confidence": round(effnet_conf, 3),
                "confidence_level": confidence_level,
                "portion_g": portion_g,
                "nutrition": nutrition,
                "db_match": db_match,
                "category": category if nutrition_entry else "unknown",
                "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "bbox_normalized": {
                    "x": round(x1/w, 4), "y": round(y1/h, 4),
                    "w": round((x2-x1)/w, 4), "h": round((y2-y1)/h, 4)
                }
            }
            foods.append(food_item)

        # Sort by confidence descending
        foods.sort(key=lambda f: f["confidence"], reverse=True)

        # Generate status
        if not foods:
            status = "no_food"
            message = "No food items could be identified. Try a clearer image."
        elif all(f["confidence_level"] == "low" for f in foods):
            status = "low_confidence"
            message = "Detection confidence is low. Results may be inaccurate."
        elif any(not f["db_match"] for f in foods):
            status = "partial_match"
            message = "Some items couldn't be matched in the nutrition database."
        else:
            status = "success"
            message = f"Detected {len(foods)} food item(s) successfully."

        # Calculate totals
        totals = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}
        for f in foods:
            for key in totals:
                totals[key] += f["nutrition"].get(key, 0)
        totals = {k: round(v, 1) for k, v in totals.items()}

        return {
            "foods": foods,
            "totals": totals,
            "scan_image": self.img_to_base64(scan_img),
            "status": status,
            "message": message,
            "food_count": len(foods)
        }


# Lazy singleton — models load on first use
food_analyzer = FoodAnalyzer()
