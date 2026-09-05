import cv2
import numpy as np
import base64
from ultralytics import YOLO
from biomechanical_rules import ExerciseAnalyzerState, DEFAULT_BIOMECHANICAL_CONFIG

import torch

class PoseAnalyzer:
    def __init__(self):
        # Load the YOLO11n-Pose model
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = YOLO("yolo11n-pose.pt")
        try:
            self.model.to(self.device)
        except Exception:
            pass
        # Dict storing exercise state machines per exercise type
        self.exercise_states = {}
        self.config = DEFAULT_BIOMECHANICAL_CONFIG

    def base64_to_img(self, b64_string):
        if "," in b64_string:
            b64_string = b64_string.split(",")[1]
        img_data = base64.b64decode(b64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img

    def get_exercise_state(self, exercise_name):
        ex_key = exercise_name.lower().replace("-", "_").replace(" ", "_")
        if ex_key not in self.exercise_states:
            self.exercise_states[ex_key] = ExerciseAnalyzerState(ex_key, self.config)
        return self.exercise_states[ex_key]

    def reset_exercise(self, exercise_name=None):
        if exercise_name:
            ex_key = exercise_name.lower().replace("-", "_").replace(" ", "_")
            if ex_key in self.exercise_states:
                self.exercise_states[ex_key].reset()
        else:
            self.exercise_states.clear()

    def update_config(self, new_config):
        self.config.update(new_config)
        for state in self.exercise_states.values():
            state.config = self.config

    def analyze_bytes(self, img_bytes, exercise="squat", debug=False):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return self.analyze_img(img, exercise=exercise, debug=debug)

    def analyze(self, b64_string, exercise="squat", debug=False):
        img = self.base64_to_img(b64_string)
        return self.analyze_img(img, exercise=exercise, debug=debug)

    def analyze_img(self, img, exercise="squat", debug=False):
        if img is None:
            return {"keypoints": [], "angles": {}, "feedback": "Invalid Frame", "reps": 0}

        results = self.model(img, imgsz=256, conf=0.10, verbose=False, device=self.device)
        
        if not results or results[0].keypoints is None or len(results[0].keypoints.data) == 0 or results[0].keypoints.data.shape[0] == 0:
            return {
                "exercise": exercise,
                "phase": "START",
                "reps": self.get_exercise_state(exercise).reps,
                "keypoints": [],
                "angles": {},
                "rom": {"current_min": 0, "current_max": 0, "last_rep_rom": 0},
                "formScore": 100,
                "violations": [],
                "confidence": 0.0,
                "feedback": "Position in camera view",
                "debug_info": {}
            }

        # Pick the person with the largest bounding box (primary user in front of camera)
        best_person_idx = 0
        max_area = 0
        boxes = results[0].boxes
        if boxes is not None and len(boxes) > 0 and boxes.xywh is not None:
            boxes_data = boxes.xywh.cpu().numpy()
            for idx, box in enumerate(boxes_data):
                area = box[2] * box[3]  # width * height
                if area > max_area:
                    max_area = area
                    best_person_idx = idx

        # Keypoints data for main person detected
        kp_data = results[0].keypoints.data[best_person_idx].cpu().numpy()
        h, w = img.shape[:2]
        
        # Normalized keypoints format for canvas overlay
        normalized_kp = [
            {"x": float(x / w), "y": float(y / h), "conf": float(c)}
            for x, y, c in kp_data
        ]

        # Analyze using biomechanical state machine
        analyzer_state = self.get_exercise_state(exercise)
        result = analyzer_state.analyze_frame(kp_data, image_width=w, image_height=h)
        result["keypoints"] = normalized_kp

        if not debug:
            result.pop("debug_info", None)

        return result

# Singleton instance
analyzer = PoseAnalyzer()
