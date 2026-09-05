"""
Feedback Dataset Collector & Custom Class Registry for FitVision
---------------------------------------------------------------------
Handles user corrections, saves cropped food images for model fine-tuning,
and registers custom food classes beyond the built-in 80 classes.
"""

import os
import json
import base64
import time
import cv2
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FEEDBACK_DIR = os.path.join(SCRIPT_DIR, "dataset_feedback")
IMAGES_DIR = os.path.join(FEEDBACK_DIR, "images")
FEEDBACK_LOG_PATH = os.path.join(FEEDBACK_DIR, "feedback_log.json")
CUSTOM_CLASSES_PATH = os.path.join(SCRIPT_DIR, "custom_classes.json")

# Ensure required directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)

class FeedbackManager:
    def __init__(self):
        self._load_custom_classes()

    def _load_custom_classes(self):
        if os.path.exists(CUSTOM_CLASSES_PATH):
            try:
                with open(CUSTOM_CLASSES_PATH, "r", encoding="utf-8") as f:
                    self.custom_classes = json.load(f)
            except Exception as e:
                print(f"[FeedbackManager] Failed to load custom classes: {e}")
                self.custom_classes = {}
        else:
            self.custom_classes = {}

    def _save_custom_classes(self):
        with open(CUSTOM_CLASSES_PATH, "w", encoding="utf-8") as f:
            json.dump(self.custom_classes, f, indent=2)

    def get_custom_classes(self):
        return self.custom_classes

    def register_custom_class(self, dish_name, category="custom", nutrition_per_100g=None):
        """Register a new food class beyond the original 80 classes."""
        key = dish_name.lower().strip().replace(" ", "_")
        
        if not nutrition_per_100g:
            nutrition_per_100g = {
                "calories": 200,
                "protein_g": 8.0,
                "carbs_g": 25.0,
                "fat_g": 7.0
            }

        entry = {
            "dish_name": dish_name.strip().title(),
            "key": key,
            "category": category,
            "nutrition_per_100g": nutrition_per_100g,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        self.custom_classes[key] = entry
        self._save_custom_classes()
        print(f"[FeedbackManager] Registered new custom class: {dish_name} ({key})")
        return entry

    def save_feedback(self, b64_image, predicted_class, corrected_class, portion_g, bbox=None, nutrition_per_100g=None):
        """Save image crop + correction metadata for future model fine-tuning."""
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        entry_id = f"fb_{timestamp}_{int(time.time()*1000)%10000}"
        
        # Save image crop
        image_filename = f"{entry_id}.jpg"
        image_path = os.path.join(IMAGES_DIR, image_filename)
        
        saved_rel_path = None
        try:
            if "," in b64_image:
                b64_image = b64_image.split(",")[1]
            img_bytes = base64.b64decode(b64_image)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is not None:
                # Crop if bounding box provided
                if bbox and all(k in bbox for k in ("x1", "y1", "x2", "y2")):
                    h, w = img.shape[:2]
                    x1, y1 = max(0, int(bbox["x1"])), max(0, int(bbox["y1"]))
                    x2, y2 = min(w, int(bbox["x2"])), min(h, int(bbox["y2"]))
                    if x2 > x1 and y2 > y1:
                        img = img[y1:y2, x1:x2]

                cv2.imwrite(image_path, img)
                saved_rel_path = os.path.join("dataset_feedback", "images", image_filename)
        except Exception as e:
            print(f"[FeedbackManager] Error saving feedback image: {e}")

        # Register custom class if corrected_class is new
        key = corrected_class.lower().strip().replace(" ", "_")
        is_new_class = False
        
        if nutrition_per_100g or (key not in self.custom_classes and key not in [
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
        ]):
            is_new_class = True
            self.register_custom_class(corrected_class, nutrition_per_100g=nutrition_per_100g)

        # Log feedback metadata
        log_entry = {
            "id": entry_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "predicted_class": predicted_class,
            "corrected_class": corrected_class,
            "is_new_class": is_new_class,
            "portion_g": portion_g,
            "image_path": saved_rel_path
        }

        # Append to feedback log
        logs = []
        if os.path.exists(FEEDBACK_LOG_PATH):
            try:
                with open(FEEDBACK_LOG_PATH, "r", encoding="utf-8") as f:
                    logs = json.load(f)
            except Exception:
                logs = []
        
        logs.append(log_entry)
        with open(FEEDBACK_LOG_PATH, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2)

        print(f"[FeedbackManager] Logged feedback entry {entry_id}: '{predicted_class}' -> '{corrected_class}'")
        return {
            "feedback_id": entry_id,
            "status": "success",
            "is_new_class": is_new_class,
            "corrected_class": corrected_class
        }

feedback_manager = FeedbackManager()
