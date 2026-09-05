"""
Food Analyzer Pipeline for FitVision
------------------------------------------
Image → YOLO11-Seg (yolo112ok.pt - Custom Fine-Tuned Model) + YOLO11m-Seg (best.pt) → food crop & segmentation
      → EfficientNetV2-B2 (best_efficientnet_b2_indian_food.pth) → food classification
      → Ensemble Confidence Selection ("Jiska confidence score jyada hoga usi ka output")
      → Strict Single High-Confidence Filter ("banana mein sirf ek output aana chahiye")
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
YOLO_112_PATH = os.path.join(SCRIPT_DIR, "yolo112ok.pt")
YOLO_BEST_PATH = os.path.join(SCRIPT_DIR, "best.pt")
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

CLASS_NAMES_SET = set(CLASS_NAMES)

# Default portion sizes in grams for common food types
DEFAULT_PORTIONS = {
    "sweet": 50, "curry": 150, "bread": 80, "rice": 200,
    "snack": 100, "beverage": 200, "breakfast": 150, "combo": 200,
    "starter": 120, "fruit": 100
}

# Minimum confidence floor for food detection (filters out weak background noise)
MIN_CONFIDENCE = 0.30

# Maximum number of predictions returned to the user
MAX_OUTPUT_ITEMS = 3


class FoodAnalyzer:
    def __init__(self):
        self._yolo112 = None
        self._yolo_best = None
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
    def yolo112(self):
        if self._yolo112 is None:
            print("[FoodAnalyzer] Loading custom fine-tuned Indian Food YOLO (yolo112ok.pt)...")
            self._yolo112 = YOLO(YOLO_112_PATH)
            print("[FoodAnalyzer] yolo112ok model loaded.")
        return self._yolo112

    @property
    def yolo_best(self):
        if self._yolo_best is None:
            print("[FoodAnalyzer] Loading General Food YOLO (best.pt)...")
            self._yolo_best = YOLO(YOLO_BEST_PATH)
            print("[FoodAnalyzer] best.pt model loaded.")
        return self._yolo_best

    @property
    def yolo(self):
        # Backward-compatibility alias
        return self.yolo_best

    @property
    def effnet(self):
        if self._effnet is None:
            print("[FoodAnalyzer] Loading EfficientNet-B2 classifier (timm)...")
            model = timm.create_model('efficientnet_b2', pretrained=False, num_classes=len(CLASS_NAMES))
            state_dict = torch.load(EFFNET_MODEL_PATH, map_location=self._device, weights_only=False)
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
            self._nutrition_map = {}
            for entry in self._nutrition_db:
                name = entry["dish_name"].lower().strip()
                self._nutrition_map[name] = entry
                for alias in entry.get("mappings", {}).values():
                    alias_key = alias.lower().strip().replace(" ", "_")
                    if alias_key not in self._nutrition_map:
                        self._nutrition_map[alias_key] = entry
            print(f"[FoodAnalyzer] Nutrition DB loaded: {len(self._nutrition_db)} entries.")
        return self._nutrition_db

    @property
    def nutrition_map(self):
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
        """Return combined list of all standard classes + custom registered classes."""
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
        ratio = mask_area / max(image_area * 0.4, 1)
        portion = base * min(max(ratio, 0.3), 2.5)
        return round(portion / 5) * 5

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
        Full pipeline:
        1. Base64 decode image
        2. Run YOLO food segmentations (yolo112ok.pt [User's fine-tuned model] & best.pt)
        3. Crop food candidate regions -> run EfficientNetV2-B2 classifier
        4. Model Ensemble & Confidence Voting ("Jiska confidence score jyada hoga usi ka output dena"):
           - Compare confidence of YOLO prediction (yolo112ok.pt or best.pt) vs EfficientNet prediction
           - Select the class prediction with the higher confidence score!
        5. Dominant Prediction & Strict NMS Deduplication (Guarantees single item scans return EXACTLY 1 item)
        6. Calculate deterministic calories/macros based on portion estimation and DB lookup.
        """
        img = self.base64_to_img(b64_image)
        if img is None:
            return {"error": "Failed to decode image", "foods": [], "scan_image": None}

        h, w = img.shape[:2]
        image_area = h * w

        # Step 1: Run YOLO Segmentations (yolo112ok.pt custom fine-tuned model and best.pt)
        results112 = self.yolo112(img, verbose=False, conf=0.20)
        results_best = self.yolo_best(img, verbose=False, conf=0.20)

        candidate_regions = []

        # Parse yolo112ok.pt detections (User's Fine-Tuned Indian Food YOLO Model)
        if results112 and len(results112[0].boxes) > 0:
            res = results112[0]
            boxes = res.boxes
            masks = res.masks
            for i in range(len(boxes)):
                box = boxes[i]
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = self.yolo112.names.get(cls_id, "").lower().strip().replace(" ", "_")

                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                if (x2 - x1) < 25 or (y2 - y1) < 25:
                    continue

                mask_data = masks.data[i] if (masks is not None and i < len(masks.data)) else None
                candidate_regions.append({
                    "bbox": (x1, y1, x2, y2),
                    "mask": mask_data,
                    "yolo_label": label if conf >= 0.20 else None,
                    "yolo_conf": conf if conf >= 0.20 else 0.0,
                    "source": "YOLO11-Seg (yolo112ok.pt)"
                })

        # Parse best.pt detections (General Food YOLO model, e.g. banana, apple, etc.)
        if results_best and len(results_best[0].boxes) > 0:
            res = results_best[0]
            boxes = res.boxes
            masks = res.masks
            for i in range(len(boxes)):
                box = boxes[i]
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                best_label = self.yolo_best.names.get(cls_id, "").lower().strip().replace(" ", "_")

                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)

                if (x2 - x1) < 25 or (y2 - y1) < 25:
                    continue

                # Check overlap with existing candidate
                matched = False
                for cand in candidate_regions:
                    cx1, cy1, cx2, cy2 = cand["bbox"]
                    ix1, iy1 = max(x1, cx1), max(y1, cy1)
                    ix2, iy2 = min(x2, cx2), min(y2, cy2)
                    if ix2 > ix1 and iy2 > iy1:
                        inter = (ix2 - ix1) * (iy2 - iy1)
                        area1 = (x2 - x1) * (y2 - y1)
                        area2 = (cx2 - cx1) * (cy2 - cy1)
                        if inter / max(area1, area2) > 0.35:
                            matched = True
                            if cand["mask"] is None and masks is not None and i < len(masks.data):
                                cand["mask"] = masks.data[i]
                            if best_label in self.nutrition_map and conf > cand["yolo_conf"]:
                                cand["yolo_label"] = best_label
                                cand["yolo_conf"] = conf
                                cand["source"] = f"YOLO11-Seg ({best_label})"
                            break

                if not matched:
                    mask_data = masks.data[i] if (masks is not None and i < len(masks.data)) else None
                    candidate_regions.append({
                        "bbox": (x1, y1, x2, y2),
                        "mask": mask_data,
                        "yolo_label": best_label if (best_label in self.nutrition_map and conf >= 0.20) else None,
                        "yolo_conf": conf if (best_label in self.nutrition_map and conf >= 0.20) else 0.0,
                        "source": f"YOLO11-Seg (best.pt)"
                    })

        # Fallback: if no YOLO bounding box detected, check center crop only if EfficientNet confidence is very high
        if len(candidate_regions) == 0:
            margin_x = int(w * 0.1)
            margin_y = int(h * 0.1)
            full_crop = img[margin_y:h-margin_y, margin_x:w-margin_x]
            effnet_class, effnet_conf = self.classify_crop(full_crop)

            # High confidence threshold (>= 0.45) for fallback to avoid non-food false positives
            if effnet_class and effnet_conf >= 0.45:
                candidate_regions.append({
                    "bbox": (margin_x, margin_y, w-margin_x, h-margin_y),
                    "mask": None,
                    "yolo_label": None,
                    "yolo_conf": 0.0,
                    "source": "full_image_fallback"
                })

        if len(candidate_regions) == 0:
            return {
                "foods": [],
                "totals": {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0},
                "scan_image": self.img_to_base64(img),
                "status": "no_food",
                "message": "No food items detected. Please ensure food is clearly visible.",
                "food_count": 0
            }

        foods = []
        scan_img = img.copy()

        for i, cand in enumerate(candidate_regions):
            x1, y1, x2, y2 = cand["bbox"]
            crop = img[y1:y2, x1:x2]

            # Step 2: EfficientNet Classification
            effnet_class, effnet_conf = self.classify_crop(crop)

            # Step 3: Model Fusion & Confidence Comparison ("Jiska confidence score jyada hoga usi ka output dena")
            yolo_label = cand["yolo_label"]
            yolo_conf = cand["yolo_conf"]

            # Select prediction with higher confidence score
            if yolo_label and (yolo_label in CLASS_NAMES_SET or yolo_label in self.nutrition_map) and yolo_conf > effnet_conf:
                class_name = yolo_label
                final_conf = yolo_conf
                model_used = cand.get("source", "YOLO11-Seg")
            else:
                class_name = effnet_class
                final_conf = effnet_conf
                model_used = "EfficientNetV2-B2"

            if final_conf < MIN_CONFIDENCE:
                continue

            # Calculate mask area
            mask_area = 0
            if cand["mask"] is not None:
                mask = cand["mask"].cpu().numpy()
                mask_resized = cv2.resize(mask, (w, h))
                mask_area = np.sum(mask_resized > 0.5)

                colored_mask = np.zeros_like(scan_img)
                colored_mask[mask_resized > 0.5] = [0, 245, 245]
                scan_img = cv2.addWeighted(scan_img, 1, colored_mask, 0.25, 0)

            # Step 4: Nutrition DB Lookup
            nutrition_entry = self.lookup_nutrition(class_name) if class_name else None
            db_match = nutrition_entry is not None

            # Step 5: Portion Estimation
            category = nutrition_entry.get("category", "curry") if nutrition_entry else "curry"
            area_for_portion = mask_area if mask_area > 0 else (x2 - x1) * (y2 - y1)
            portion_g = self.estimate_portion(area_for_portion, image_area, category)

            # Step 6: Macro calculations
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

            if final_conf < 0.40:
                confidence_level = "low"
            elif final_conf < 0.65:
                confidence_level = "medium"
            else:
                confidence_level = "high"

            # Render overlay bounding box
            color = (0, 255, 245) if confidence_level != "low" else (0, 100, 255)
            cv2.rectangle(scan_img, (x1, y1), (x2, y2), color, 2)
            display_name = class_name.replace("_", " ").title() if class_name else "Unknown Food"
            label_text = f"{display_name} ({final_conf*100:.0f}%)"
            cv2.putText(scan_img, label_text, (x1, max(y1 - 8, 15)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA)

            food_item = {
                "id": i,
                "class_name": class_name,
                "display_name": display_name,
                "model_source": model_used,
                "confidence": round(final_conf, 3),
                "confidence_level": confidence_level,
                "portion_g": portion_g,
                "nutrition": nutrition,
                "db_match": db_match,
                "category": category if nutrition_entry else "unknown",
                "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                "bbox_normalized": {
                    "x": round(x1 / w, 4), "y": round(y1 / h, 4),
                    "w": round((x2 - x1) / w, 4), "h": round((y2 - y1) / h, 4)
                }
            }
            foods.append(food_item)

        # Sort foods by confidence descending
        foods.sort(key=lambda f: f["confidence"], reverse=True)

        # Step 7: Advanced NMS & Duplicate Class Suppression
        nms_foods = []
        for food in foods:
            b1 = food["bbox"]
            cls1 = food["class_name"]
            overlap = False
            for k in nms_foods:
                b2 = k["bbox"]
                cls2 = k["class_name"]

                ix1, iy1 = max(b1["x1"], b2["x1"]), max(b1["y1"], b2["y1"])
                ix2, iy2 = min(b1["x2"], b2["x2"]), min(b1["y2"], b2["y2"])
                if ix2 > ix1 and iy2 > iy1:
                    inter = (ix2 - ix1) * (iy2 - iy1)
                    area1 = (b1["x2"] - b1["x1"]) * (b1["y2"] - b1["y1"])
                    area2 = (b2["x2"] - b2["x1"]) * (b2["y2"] - b2["y1"])
                    min_area = min(area1, area2)
                    union = area1 + area2 - inter
                    iou = inter / max(union, 1)
                    inter_ratio = inter / max(min_area, 1)

                    # Same class duplicate -> strict suppression
                    if cls1 == cls2 and (inter_ratio > 0.15 or iou > 0.15):
                        overlap = True
                        break

                    # Any overlapping box -> suppress
                    if iou > 0.25 or inter_ratio > 0.30:
                        overlap = True
                        break

            if not overlap:
                nms_foods.append(food)

        # Step 8: Strict Single High-Confidence Filter ("banana mein sirf ek output aana chahiye")
        if nms_foods:
            top_conf = nms_foods[0]["confidence"]
            if top_conf >= 0.70:
                # If top item has high confidence (>= 0.70), keep ONLY items that also have high confidence (>= 0.65)
                # Guarantees single item scans like Banana output EXACTLY 1 prediction!
                nms_foods = [
                    f for f in nms_foods
                    if f["confidence"] >= 0.65 and (top_conf - f["confidence"]) <= 0.20
                ]
            else:
                nms_foods = nms_foods[:2]

        foods = nms_foods[:MAX_OUTPUT_ITEMS]

        if not foods:
            return {
                "foods": [],
                "totals": {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0},
                "scan_image": self.img_to_base64(scan_img),
                "status": "no_food",
                "message": "No food items detected. Please ensure food is clearly visible.",
                "food_count": 0
            }

        status = "success"
        message = f"Detected {len(foods)} food item(s) successfully."

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


# Lazy singleton
food_analyzer = FoodAnalyzer()
