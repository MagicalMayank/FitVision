# biomechanical_rules.py - Comprehensive Biomechanical Rules Engine for 10 Exercises
# Uses YOLO11n-Pose 17-keypoint coordinates, temporal smoothing, hysteresis state machines, & non-medical form heuristics.

import numpy as np

# ---------------------------------------------------------
# 17 COCO Keypoint Index Definitions
# ---------------------------------------------------------
KP_NOSE = 0
KP_LEFT_EYE = 1
KP_RIGHT_EYE = 2
KP_LEFT_EAR = 3
KP_RIGHT_EAR = 4
KP_LEFT_SHOULDER = 5
KP_RIGHT_SHOULDER = 6
KP_LEFT_ELBOW = 7
KP_RIGHT_ELBOW = 8
KP_LEFT_WRIST = 9
KP_RIGHT_WRIST = 10
KP_LEFT_HIP = 11
KP_RIGHT_HIP = 12
KP_LEFT_KNEE = 13
KP_RIGHT_KNEE = 14
KP_LEFT_ANKLE = 15
KP_RIGHT_ANKLE = 16

# ---------------------------------------------------------
# Default Configurable Biomechanical Thresholds & Parameters
# ---------------------------------------------------------
DEFAULT_BIOMECHANICAL_CONFIG = {
    "min_kp_confidence": 0.45,
    "smoothing_alpha": 0.35,  # EMA temporal smoothing factor (0.0 to 1.0)
    "min_consecutive_frames": 2, # Minimum frames to confirm state transition / violation
    
    # 1. SQUAT
    "squat": {
        "top_knee_angle": 160.0,
        "bottom_knee_angle": 90.0,
        "hysteresis_deg": 6.0,
        "max_torso_lean_deg": 60.0, # Hip angle (Shoulder-Hip-Knee)
        "valgus_threshold_ratio": 0.85
    },

    # 2. PUSH-UP
    "pushup": {
        "top_elbow_angle": 160.0,
        "bottom_elbow_angle": 90.0,
        "body_line_min_angle": 150.0, # Shoulder-Hip-Ankle body alignment
        "sag_tolerance_deg": 12.0,
        "elbow_asymmetry_max_deg": 15.0,
        "hysteresis_deg": 5.0
    },

    # 3. LUNGE
    "lunge": {
        "standing_knee_angle": 160.0,
        "bottom_knee_angle": 100.0, # Reference target ~90°
        "torso_upright_min_deg": 68.0,
        "asymmetry_max_deg": 15.0,
        "hysteresis_deg": 6.0
    },

    # 4. GLUTE BRIDGE
    "glute_bridge": {
        "down_hip_angle": 120.0,
        "top_hip_extension_angle": 160.0, # Shoulder-Hip-Knee near straight
        "knee_flexion_min": 75.0,
        "knee_flexion_max": 115.0,
        "pelvic_asymmetry_max_deg": 15.0,
        "hysteresis_deg": 6.0
    },

    # 5. PLANK
    "plank": {
        "body_line_target_angle": 170.0,
        "body_line_min_angle": 155.0,
        "sag_tolerance_deg": 15.0,
        "hold_min_frames": 3,
        "hysteresis_deg": 4.0
    },

    # 6. BICEP CURL
    "bicep_curl": {
        "extended_elbow_angle": 150.0,
        "contracted_elbow_angle": 50.0,
        "max_elbow_drift_ratio": 0.18, # Relative to torso height
        "max_torso_swing_deg": 15.0,
        "asymmetry_max_deg": 20.0,
        "hysteresis_deg": 6.0
    },

    # 7. SHOULDER PRESS
    "shoulder_press": {
        "bottom_elbow_angle": 100.0,
        "overhead_elbow_angle": 160.0,
        "arm_asymmetry_max_deg": 20.0,
        "max_torso_arch_deg": 20.0,
        "hysteresis_deg": 6.0
    },

    # 8. MOUNTAIN CLIMBER
    "mountain_climber": {
        "body_line_min_angle": 150.0,
        "knee_drive_hip_flexion_deg": 100.0, # Hip angle <= 100° during drive
        "hysteresis_deg": 6.0
    },

    # 9. JUMPING JACK
    "jumping_jack": {
        "closed_feet_ratio": 1.1, # Normalized to hip width W
        "open_feet_ratio": 1.5,   # Reference target ~1.6W
        "open_arm_elevation_deg": 150.0, # Shoulder elevation / overhead
        "asymmetry_max_ratio": 0.25,
        "hysteresis_ratio": 0.1
    },

    # 10. CALF RAISE
    "calf_raise": {
        "baseline_window_frames": 10,
        "heel_rise_threshold_ratio": 0.045, # Ankle upward displacement normalized by torso height
        "knee_extension_min_deg": 155.0,
        "asymmetry_max_ratio": 0.025,
        "hysteresis_ratio": 0.01
    }
}


# ---------------------------------------------------------
# Helper Mathematical & Vector Functions
# ---------------------------------------------------------
def calculate_angle(a, b, c):
    """Calculates 3-point 2D angle (in degrees) at vertex B using atan2."""
    if a is None or b is None or c is None:
        return None
    a = np.array(a[:2], dtype=np.float32)
    b = np.array(b[:2], dtype=np.float32)
    c = np.array(c[:2], dtype=np.float32)
    
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360.0 - angle
    return float(angle)

def euclidean_distance(pt1, pt2):
    if pt1 is None or pt2 is None:
        return 0.0
    return float(np.linalg.norm(np.array(pt1[:2]) - np.array(pt2[:2])))

def is_kp_valid(kp, min_conf=0.45):
    return kp is not None and len(kp) >= 3 and kp[2] >= min_conf


# ---------------------------------------------------------
# Temporal Angle & Keypoint Moving Average Filter
# ---------------------------------------------------------
class TemporalSmoother:
    def __init__(self, alpha=0.35):
        self.alpha = alpha
        self.prev_angles = {}

    def smooth(self, key, new_val):
        if new_val is None:
            return None
        if key not in self.prev_angles or self.prev_angles[key] is None:
            self.prev_angles[key] = new_val
            return new_val
        smoothed = self.alpha * new_val + (1.0 - self.alpha) * self.prev_angles[key]
        self.prev_angles[key] = smoothed
        return smoothed

    def reset(self):
        self.prev_angles.clear()


# ---------------------------------------------------------
# Comprehensive 10-Exercise Biomechanical Analyzer Class
# ---------------------------------------------------------
class ExerciseAnalyzerState:
    def __init__(self, exercise_name="squat", config=None):
        self.exercise = exercise_name.lower().replace("-", "_").replace(" ", "_")
        self.config = config or DEFAULT_BIOMECHANICAL_CONFIG
        self.smoother = TemporalSmoother(alpha=self.config.get("smoothing_alpha", 0.35))
        
        # State Machine Tracking
        self.state = "START"
        self.reps = 0
        self.hold_time_seconds = 0.0
        self.hold_frames = 0
        
        # Hysteresis & Temporal Stability
        self.consecutive_state_frames = 0
        self.candidate_state = "START"
        
        # ROM & Performance Tracking
        self.current_rep_min = 999.0
        self.current_rep_max = -999.0
        self.last_rep_rom = 0.0
        
        # Calibration / Baselines
        self.baseline_ankle_y = None
        self.baseline_torso_h = None
        self.calibration_samples = []

        # Violations & Form Score
        self.rolling_violations = []
        self.violation_frame_counts = {}
        self.form_score = 100

    def reset(self):
        self.state = "START"
        self.reps = 0
        self.hold_time_seconds = 0.0
        self.hold_frames = 0
        self.consecutive_state_frames = 0
        self.current_rep_min = 999.0
        self.current_rep_max = -999.0
        self.last_rep_rom = 0.0
        self.smoother.reset()
        self.rolling_violations.clear()
        self.violation_frame_counts.clear()
        self.form_score = 100

    def _transition_state(self, new_state, min_required_frames=2):
        if new_state == self.candidate_state:
            self.consecutive_state_frames += 1
        else:
            self.candidate_state = new_state
            self.consecutive_state_frames = 1
            
        if self.consecutive_state_frames >= min_required_frames and self.state != new_state:
            self.state = new_state
            return True
        return False

    def _register_violation(self, key, description, min_frames=2):
        count = self.violation_frame_counts.get(key, 0) + 1
        self.violation_frame_counts[key] = count
        if count >= min_frames and description not in self.rolling_violations:
            self.rolling_violations.append(description)

    def _clear_violation(self, key, description):
        self.violation_frame_counts[key] = 0
        if description in self.rolling_violations:
            self.rolling_violations.remove(description)

    def analyze_frame(self, kp_data, image_width=640, image_height=480):
        """Analyzes a single frame keypoint array [17 x 3] for active exercise."""
        min_conf = self.config.get("min_kp_confidence", 0.45)
        min_req_frames = self.config.get("min_consecutive_frames", 2)
        
        # Keypoints extraction
        kp = {i: kp_data[i] if (len(kp_data) > i and kp_data[i][2] >= min_conf) else None for i in range(17)}
        
        # Calculate raw angles
        l_knee = calculate_angle(kp[KP_LEFT_HIP], kp[KP_LEFT_KNEE], kp[KP_LEFT_ANKLE])
        r_knee = calculate_angle(kp[KP_RIGHT_HIP], kp[KP_RIGHT_KNEE], kp[KP_RIGHT_ANKLE])
        
        l_elbow = calculate_angle(kp[KP_LEFT_SHOULDER], kp[KP_LEFT_ELBOW], kp[KP_LEFT_WRIST])
        r_elbow = calculate_angle(kp[KP_RIGHT_SHOULDER], kp[KP_RIGHT_ELBOW], kp[KP_RIGHT_WRIST])
        
        l_hip_ext = calculate_angle(kp[KP_LEFT_SHOULDER], kp[KP_LEFT_HIP], kp[KP_LEFT_KNEE])
        r_hip_ext = calculate_angle(kp[KP_RIGHT_SHOULDER], kp[KP_RIGHT_HIP], kp[KP_RIGHT_KNEE])
        
        l_body_line = calculate_angle(kp[KP_LEFT_SHOULDER], kp[KP_LEFT_HIP], kp[KP_LEFT_ANKLE])
        r_body_line = calculate_angle(kp[KP_RIGHT_SHOULDER], kp[KP_RIGHT_HIP], kp[KP_RIGHT_ANKLE])

        # Smooth angles
        s_l_knee = self.smoother.smooth("l_knee", l_knee)
        s_r_knee = self.smoother.smooth("r_knee", r_knee)
        s_l_elbow = self.smoother.smooth("l_elbow", l_elbow)
        s_r_elbow = self.smoother.smooth("r_elbow", r_elbow)
        s_l_hip_ext = self.smoother.smooth("l_hip_ext", l_hip_ext)
        s_r_hip_ext = self.smoother.smooth("r_hip_ext", r_hip_ext)
        s_l_body_line = self.smoother.smooth("l_body_line", l_body_line)
        s_r_body_line = self.smoother.smooth("r_body_line", r_body_line)

        # Side averaging helpers
        knees = [k for k in [s_l_knee, s_r_knee] if k is not None]
        avg_knee = np.mean(knees) if knees else None
        
        elbows = [e for e in [s_l_elbow, s_r_elbow] if e is not None]
        avg_elbow = np.mean(elbows) if elbows else None

        hips_ext = [h for h in [s_l_hip_ext, s_r_hip_ext] if h is not None]
        avg_hip_ext = np.mean(hips_ext) if hips_ext else None

        body_lines = [b for b in [s_l_body_line, s_r_body_line] if b is not None]
        avg_body_line = np.mean(body_lines) if body_lines else None

        # Data structure for response
        angles = {}
        violations = []
        feedback = "Position yourself in frame"
        confidence_avg = float(np.mean([k[2] for k in kp_data if len(k) >= 3])) if len(kp_data) > 0 else 0.0
        debug_info = {}

        # ---------------------------------------------------------
        # EXERCISE 1: SQUAT
        # ---------------------------------------------------------
        if "squat" in self.exercise:
            cfg = self.config["squat"]
            angles = {"knee": avg_knee, "hip_extension": avg_hip_ext}
            if avg_knee is not None:
                self.current_rep_min = min(self.current_rep_min, avg_knee)
                self.current_rep_max = max(self.current_rep_max, avg_knee)

                top_thresh = cfg["top_knee_angle"] - cfg["hysteresis_deg"]
                bottom_thresh = cfg["bottom_knee_angle"] + cfg["hysteresis_deg"]

                if self.state in ["START", "TOP"] and avg_knee < top_thresh:
                    self._transition_state("DESCENDING", min_req_frames)
                elif self.state == "DESCENDING" and avg_knee <= cfg["bottom_knee_angle"]:
                    self._transition_state("BOTTOM", min_req_frames)
                elif self.state == "BOTTOM" and avg_knee > bottom_thresh:
                    self._transition_state("ASCENDING", min_req_frames)
                elif self.state == "ASCENDING" and avg_knee >= cfg["top_knee_angle"]:
                    if self._transition_state("TOP", min_req_frames):
                        self.reps += 1
                        self.last_rep_rom = self.current_rep_max - self.current_rep_min
                        self.current_rep_min = 999.0
                        self.current_rep_max = -999.0

                # Form Checks
                if self.state == "BOTTOM" and avg_knee > cfg["bottom_knee_angle"] + 5.0:
                    self._register_violation("depth", "Technique correction: Incomplete squat depth", min_req_frames)
                else:
                    self._clear_violation("depth", "Technique correction: Incomplete squat depth")

                if avg_hip_ext is not None and avg_hip_ext < cfg["max_torso_lean_deg"]:
                    self._register_violation("torso", "Form deviation: Excessive forward torso lean", min_req_frames)
                else:
                    self._clear_violation("torso", "Form deviation: Excessive forward torso lean")

                feedback = f"Squat: {self.state}"
                if self.state == "BOTTOM":
                    feedback = "Great Depth - Drive Up"
                elif self.state == "DESCENDING":
                    feedback = "Keep chest up - Descending"

        # ---------------------------------------------------------
        # EXERCISE 2: PUSH-UP
        # ---------------------------------------------------------
        elif "push" in self.exercise:
            cfg = self.config["pushup"]
            angles = {"elbow": avg_elbow, "body_line": avg_body_line, "left_elbow": s_l_elbow, "right_elbow": s_r_elbow}
            if avg_elbow is not None:
                self.current_rep_min = min(self.current_rep_min, avg_elbow)
                self.current_rep_max = max(self.current_rep_max, avg_elbow)

                top_t = cfg["top_elbow_angle"] - cfg["hysteresis_deg"]
                bot_t = cfg["bottom_elbow_angle"] + cfg["hysteresis_deg"]

                if self.state in ["START", "TOP"] and avg_elbow < top_t:
                    self._transition_state("DESCENDING", min_req_frames)
                elif self.state == "DESCENDING" and avg_elbow <= cfg["bottom_elbow_angle"]:
                    self._transition_state("BOTTOM", min_req_frames)
                elif self.state == "BOTTOM" and avg_elbow > bot_t:
                    self._transition_state("ASCENDING", min_req_frames)
                elif self.state == "ASCENDING" and avg_elbow >= cfg["top_elbow_angle"]:
                    if self._transition_state("TOP", min_req_frames):
                        self.reps += 1
                        self.last_rep_rom = self.current_rep_max - self.current_rep_min
                        self.current_rep_min = 999.0
                        self.current_rep_max = -999.0

                # Form Checks
                if avg_body_line is not None and avg_body_line < cfg["body_line_min_angle"]:
                    self._register_violation("hip_sag", "Form deviation: Hip sag outside target line", min_req_frames)
                else:
                    self._clear_violation("hip_sag", "Form deviation: Hip sag outside target line")

                if s_l_elbow is not None and s_r_elbow is not None:
                    if abs(s_l_elbow - s_r_elbow) > cfg["elbow_asymmetry_max_deg"]:
                        self._register_violation("asym", "Technique correction: Asymmetric elbow bend", min_req_frames)
                    else:
                        self._clear_violation("asym", "Technique correction: Asymmetric elbow bend")

                feedback = f"Push-up: {self.state}"
                if self.state == "BOTTOM":
                    feedback = "Push up strong"

        # ---------------------------------------------------------
        # EXERCISE 3: LUNGE
        # ---------------------------------------------------------
        elif "lunge" in self.exercise:
            cfg = self.config["lunge"]
            angles = {"left_knee": s_l_knee, "right_knee": s_r_knee, "front_knee": avg_knee, "torso": avg_hip_ext}
            if avg_knee is not None:
                self.current_rep_min = min(self.current_rep_min, avg_knee)
                self.current_rep_max = max(self.current_rep_max, avg_knee)

                stand_t = cfg["standing_knee_angle"] - cfg["hysteresis_deg"]
                bot_t = cfg["bottom_knee_angle"] + cfg["hysteresis_deg"]

                if self.state in ["START", "STANDING"] and avg_knee < stand_t:
                    self._transition_state("DESCENDING", min_req_frames)
                elif self.state == "DESCENDING" and avg_knee <= cfg["bottom_knee_angle"]:
                    self._transition_state("BOTTOM", min_req_frames)
                elif self.state == "BOTTOM" and avg_knee > bot_t:
                    self._transition_state("ASCENDING", min_req_frames)
                elif self.state == "ASCENDING" and avg_knee >= cfg["standing_knee_angle"]:
                    if self._transition_state("STANDING", min_req_frames):
                        self.reps += 1
                        self.last_rep_rom = self.current_rep_max - self.current_rep_min
                        self.current_rep_min = 999.0
                        self.current_rep_max = -999.0

                if self.state == "BOTTOM" and avg_knee > cfg["bottom_knee_angle"] + 5.0:
                    self._register_violation("shallow", "Form deviation: Shallow lunge depth", min_req_frames)
                else:
                    self._clear_violation("shallow", "Form deviation: Shallow lunge depth")

                feedback = f"Lunge: {self.state}"

        # ---------------------------------------------------------
        # EXERCISE 4: GLUTE BRIDGE
        # ---------------------------------------------------------
        elif "bridge" in self.exercise or "glute" in self.exercise:
            cfg = self.config["glute_bridge"]
            angles = {"hip_extension": avg_hip_ext, "knee_angle": avg_knee}
            if avg_hip_ext is not None:
                self.current_rep_min = min(self.current_rep_min, avg_hip_ext)
                self.current_rep_max = max(self.current_rep_max, avg_hip_ext)

                down_t = cfg["down_hip_angle"] + cfg["hysteresis_deg"]
                top_t = cfg["top_hip_extension_angle"] - cfg["hysteresis_deg"]

                if self.state in ["START", "DOWN"] and avg_hip_ext > down_t:
                    self._transition_state("RISING", min_req_frames)
                elif self.state == "RISING" and avg_hip_ext >= cfg["top_hip_extension_angle"]:
                    self._transition_state("TOP", min_req_frames)
                elif self.state == "TOP" and avg_hip_ext < top_t:
                    self._transition_state("LOWERING", min_req_frames)
                elif self.state == "LOWERING" and avg_hip_ext <= cfg["down_hip_angle"]:
                    if self._transition_state("DOWN", min_req_frames):
                        self.reps += 1
                        self.last_rep_rom = self.current_rep_max - self.current_rep_min
                        self.current_rep_min = 999.0
                        self.current_rep_max = -999.0

                if self.state == "TOP" and avg_hip_ext < cfg["top_hip_extension_angle"] - 5.0:
                    self._register_violation("hip_ext", "Form deviation: Insufficient hip extension", min_req_frames)
                else:
                    self._clear_violation("hip_ext", "Form deviation: Insufficient hip extension")

                feedback = f"Glute Bridge: {self.state}"

        # ---------------------------------------------------------
        # EXERCISE 5: PLANK
        # ---------------------------------------------------------
        elif "plank" in self.exercise:
            cfg = self.config["plank"]
            angles = {"body_line": avg_body_line, "left_elbow": s_l_elbow, "right_elbow": s_r_elbow}
            if avg_body_line is not None:
                valid_line = avg_body_line >= cfg["body_line_min_angle"]
                if valid_line:
                    if self._transition_state("HOLDING", cfg["hold_min_frames"]):
                        self.hold_frames += 1
                    else:
                        self.hold_frames += 1
                    self.hold_time_seconds = round(self.hold_frames * 0.25, 1) # 250ms loop interval
                    self.reps = int(self.hold_time_seconds) # expose hold time in reps field
                    self._clear_violation("plank_sag", "Form deviation: Body line sag detected")
                else:
                    self._transition_state("POOR_FORM", cfg["hold_min_frames"])
                    self._register_violation("plank_sag", "Form deviation: Body line sag detected", min_req_frames)

                feedback = f"Plank Hold: {self.hold_time_seconds}s"

        # ---------------------------------------------------------
        # EXERCISE 6: BICEP CURL
        # ---------------------------------------------------------
        elif "curl" in self.exercise or "bicep" in self.exercise:
            cfg = self.config["bicep_curl"]
            angles = {"left_elbow": s_l_elbow, "right_elbow": s_r_elbow, "elbow": avg_elbow}
            if avg_elbow is not None:
                self.current_rep_min = min(self.current_rep_min, avg_elbow)
                self.current_rep_max = max(self.current_rep_max, avg_elbow)

                ext_t = cfg["extended_elbow_angle"] - cfg["hysteresis_deg"]
                curl_t = cfg["contracted_elbow_angle"] + cfg["hysteresis_deg"]

                if self.state in ["START", "EXTENDED"] and avg_elbow < ext_t:
                    self._transition_state("CURLING", min_req_frames)
                elif self.state == "CURLING" and avg_elbow <= cfg["contracted_elbow_angle"]:
                    self._transition_state("CONTRACTED", min_req_frames)
                elif self.state == "CONTRACTED" and avg_elbow > curl_t:
                    self._transition_state("LOWERING", min_req_frames)
                elif self.state == "LOWERING" and avg_elbow >= cfg["extended_elbow_angle"]:
                    if self._transition_state("EXTENDED", min_req_frames):
                        self.reps += 1
                        self.last_rep_rom = self.current_rep_max - self.current_rep_min
                        self.current_rep_min = 999.0
                        self.current_rep_max = -999.0

                if s_l_elbow is not None and s_r_elbow is not None and abs(s_l_elbow - s_r_elbow) > cfg["asymmetry_max_deg"]:
                    self._register_violation("arm_asym", "Technique correction: Left/Right arm asymmetry", min_req_frames)
                else:
                    self._clear_violation("arm_asym", "Technique correction: Left/Right arm asymmetry")

                feedback = f"Bicep Curl: {self.state}"

        # ---------------------------------------------------------
        # EXERCISE 7: SHOULDER PRESS
        # ---------------------------------------------------------
        elif "press" in self.exercise or "shoulder" in self.exercise:
            cfg = self.config["shoulder_press"]
            
            # Check wrist overhead elevation relative to shoulder
            wrists_above_shoulders = False
            if is_kp_valid(kp[KP_LEFT_WRIST]) and is_kp_valid(kp[KP_LEFT_SHOULDER]):
                if kp[KP_LEFT_WRIST][1] < kp[KP_LEFT_SHOULDER][1]:
                    wrists_above_shoulders = True

            angles = {"left_elbow": s_l_elbow, "right_elbow": s_r_elbow, "elbow": avg_elbow, "overhead": wrists_above_shoulders}
            if avg_elbow is not None:
                self.current_rep_min = min(self.current_rep_min, avg_elbow)
                self.current_rep_max = max(self.current_rep_max, avg_elbow)

                bot_t = cfg["bottom_elbow_angle"] + cfg["hysteresis_deg"]
                top_t = cfg["overhead_elbow_angle"] - cfg["hysteresis_deg"]

                if self.state in ["START", "BOTTOM"] and avg_elbow > bot_t:
                    self._transition_state("PRESSING", min_req_frames)
                elif self.state == "PRESSING" and avg_elbow >= cfg["overhead_elbow_angle"]:
                    self._transition_state("OVERHEAD", min_req_frames)
                elif self.state == "OVERHEAD" and avg_elbow < top_t:
                    self._transition_state("LOWERING", min_req_frames)
                elif self.state == "LOWERING" and avg_elbow <= cfg["bottom_elbow_angle"]:
                    if self._transition_state("BOTTOM", min_req_frames):
                        self.reps += 1
                        self.last_rep_rom = self.current_rep_max - self.current_rep_min
                        self.current_rep_min = 999.0
                        self.current_rep_max = -999.0

                if s_l_elbow is not None and s_r_elbow is not None and abs(s_l_elbow - s_r_elbow) > cfg["arm_asymmetry_max_deg"]:
                    self._register_violation("press_asym", "Technique correction: Asymmetric arm extension", min_req_frames)
                else:
                    self._clear_violation("press_asym", "Technique correction: Asymmetric arm extension")

                feedback = f"Shoulder Press: {self.state}"

        # ---------------------------------------------------------
        # EXERCISE 8: MOUNTAIN CLIMBER
        # ---------------------------------------------------------
        elif "climber" in self.exercise or "mountain" in self.exercise:
            cfg = self.config["mountain_climber"]
            angles = {"left_hip_flexion": s_l_hip_ext, "right_hip_flexion": s_r_hip_ext, "body_line": avg_body_line}
            
            l_drive = s_l_hip_ext is not None and s_l_hip_ext <= cfg["knee_drive_hip_flexion_deg"]
            r_drive = s_r_hip_ext is not None and s_r_hip_ext <= cfg["knee_drive_hip_flexion_deg"]

            if l_drive and self.state != "LEFT_KNEE_DRIVE":
                if self._transition_state("LEFT_KNEE_DRIVE", min_req_frames):
                    self.reps += 1
            elif r_drive and self.state != "RIGHT_KNEE_DRIVE":
                if self._transition_state("RIGHT_KNEE_DRIVE", min_req_frames):
                    self.reps += 1

            feedback = f"Mountain Climber: Reps {self.reps}"

        # ---------------------------------------------------------
        # EXERCISE 9: JUMPING JACK
        # ---------------------------------------------------------
        elif "jack" in self.exercise or "jumping" in self.exercise:
            cfg = self.config["jumping_jack"]
            
            # Ankle separation ratio relative to hip width W
            feet_ratio = 1.0
            if is_kp_valid(kp[KP_LEFT_HIP]) and is_kp_valid(kp[KP_RIGHT_HIP]) and is_kp_valid(kp[KP_LEFT_ANKLE]) and is_kp_valid(kp[KP_RIGHT_ANKLE]):
                hip_w = max(0.05, abs(kp[KP_RIGHT_HIP][0] - kp[KP_LEFT_HIP][0]))
                ankle_dist = abs(kp[KP_RIGHT_ANKLE][0] - kp[KP_LEFT_ANKLE][0])
                feet_ratio = ankle_dist / hip_w

            arms_elevated = (s_l_elbow is not None and s_l_elbow >= 140.0) or (is_kp_valid(kp[KP_LEFT_WRIST]) and is_kp_valid(kp[KP_LEFT_SHOULDER]) and kp[KP_LEFT_WRIST][1] < kp[KP_LEFT_SHOULDER][1])

            angles = {"feet_ratio": round(feet_ratio, 2), "arm_elevation": arms_elevated}

            if feet_ratio >= cfg["open_feet_ratio"] and arms_elevated:
                self._transition_state("OPEN", min_req_frames)
            elif feet_ratio <= cfg["closed_feet_ratio"]:
                if self.state == "OPEN":
                    if self._transition_state("CLOSED", min_req_frames):
                        self.reps += 1
                else:
                    self._transition_state("CLOSED", min_req_frames)

            feedback = f"Jumping Jack: {self.state}"

        # ---------------------------------------------------------
        # EXERCISE 10: CALF RAISE
        # ---------------------------------------------------------
        elif "calf" in self.exercise or "raise" in self.exercise:
            cfg = self.config["calf_raise"]
            
            # Use ankle vertical position relative to knee/hip normalized by torso height
            normalized_heel_rise = 0.0
            if is_kp_valid(kp[KP_LEFT_ANKLE]) and is_kp_valid(kp[KP_LEFT_KNEE]) and is_kp_valid(kp[KP_LEFT_HIP]) and is_kp_valid(kp[KP_LEFT_SHOULDER]):
                torso_h = max(0.1, abs(kp[KP_LEFT_HIP][1] - kp[KP_LEFT_SHOULDER][1]))
                ankle_rel = kp[KP_LEFT_KNEE][1] - kp[KP_LEFT_ANKLE][1] # baseline relative offset
                
                if self.baseline_ankle_y is None:
                    self.baseline_ankle_y = ankle_rel
                
                # Upward rise decreases y coordinate, increasing ankle_rel
                rise_diff = ankle_rel - self.baseline_ankle_y
                normalized_heel_rise = rise_diff / torso_h

            angles = {"heel_rise_rom": round(normalized_heel_rise, 4), "knee_angle": avg_knee}

            if normalized_heel_rise >= cfg["heel_rise_threshold_ratio"]:
                self._transition_state("PEAK", min_req_frames)
            elif normalized_heel_rise <= 0.01:
                if self.state == "PEAK":
                    if self._transition_state("DOWN", min_req_frames):
                        self.reps += 1
                else:
                    self._transition_state("DOWN", min_req_frames)

            if avg_knee is not None and avg_knee < cfg["knee_extension_min_deg"]:
                self._register_violation("knee_bend", "Technique correction: Excessive knee bending during calf raise", min_req_frames)
            else:
                self._clear_violation("knee_bend", "Technique correction: Excessive knee bending during calf raise")

            feedback = f"Calf Raise: {self.state}"

        # Combine violations & calculate rolling Form Score
        violations = list(self.rolling_violations)
        deduction = len(violations) * 8
        self.form_score = max(50, 100 - deduction)

        # Standardized return structure
        return {
            "exercise": self.exercise,
            "phase": self.state,
            "reps": self.reps,
            "angles": {k: float(v) if v is not None and not isinstance(v, bool) else v for k, v in angles.items()},
            "rom": {
                "current_min": float(self.current_rep_min) if self.current_rep_min != 999.0 else 0.0,
                "current_max": float(self.current_rep_max) if self.current_rep_max != -999.0 else 0.0,
                "last_rep_rom": float(self.last_rep_rom)
            },
            "formScore": self.form_score,
            "violations": violations,
            "confidence": round(float(confidence_avg), 3),
            "feedback": feedback if not violations else violations[0],
            "debug_info": {
                "state": self.state,
                "consecutive_frames": self.consecutive_state_frames,
                "raw_angles": {"l_knee": l_knee, "r_knee": r_knee, "l_elbow": l_elbow, "r_elbow": r_elbow},
                "smoothed_angles": {"l_knee": s_l_knee, "r_knee": s_r_knee, "l_elbow": s_l_elbow, "r_elbow": s_r_elbow},
                "thresholds": self.config.get(self.exercise, {})
            }
        }
