"""
FireGuard AI - YOLOv8 Real-Time AI Fire Detection Module
Description: Performs deep learning inference on video frames using Ultralytics YOLOv8.
Extracts bounding boxes, detects flames/smoke, and filters low-confidence false positives.
"""

import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO
from config import DEFAULT_MODEL_PATH, FALLBACK_MODEL_NAME

class FireDetector:
    """
    AI Detection Engine wrapping YOLOv8 for fire and smoke recognition.
    """
    def __init__(self, model_path=DEFAULT_MODEL_PATH, conf_threshold=0.70):
        self.conf_threshold = conf_threshold
        self.model = None
        self.is_custom_model = False
        self.load_model(model_path)

    def load_model(self, model_path):
        """Loads custom YOLOv8 fire weights or falls back to pretrained yolov8n."""
        try:
            path_obj = Path(model_path)
            if path_obj.exists():
                print(f"[AI] Loading custom fire detection model from: {model_path}")
                self.model = YOLO(str(model_path))
                self.is_custom_model = True
            else:
                print(f"[AI] Custom model '{model_path}' not found on disk. Loading fallback YOLOv8...")
                self.model = YOLO(FALLBACK_MODEL_NAME)
                self.is_custom_model = False
        except Exception as e:
            print(f"[AI] Error loading YOLO model: {e}. Reinitializing default YOLOv8n...")
            self.model = YOLO(FALLBACK_MODEL_NAME)

    def set_confidence_threshold(self, threshold: float):
        """Updates the confidence threshold (0.1 to 0.99)."""
        self.conf_threshold = max(0.1, min(0.99, threshold))

    def detect(self, frame: np.ndarray):
        """
        Runs YOLOv8 inference on a single BGR OpenCV frame.
        
        Returns:
            annotated_frame: np.ndarray (frame with red bounding boxes and text labels)
            detections: list of dicts [{'label': 'fire', 'confidence': 0.95, 'bbox': [x1,y1,x2,y2]}]
            has_fire: bool
        """
        if self.model is None or frame is None:
            return frame, [], False

        detections = []
        has_fire = False
        annotated_frame = frame.copy()

        try:
            results = self.model(frame, conf=self.conf_threshold, verbose=False)
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    cls_name = self.model.names[cls_id].lower()
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())

                    # Check for fire or smoke classes
                    is_fire = "fire" in cls_name or "flame" in cls_name
                    is_smoke = "smoke" in cls_name

                    if is_fire or is_smoke:
                        has_fire = True
                        label = f"FIRE: {int(conf * 100)}%" if is_fire else f"SMOKE: {int(conf * 100)}%"
                        color = (0, 0, 255) if is_fire else (0, 165, 255) # BGR Red or Orange

                        detections.append({
                            "label": cls_name,
                            "confidence": conf,
                            "bbox": [x1, y1, x2, y2]
                        })

                        # Draw Bounding Box & Label
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 3)
                        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                        cv2.rectangle(annotated_frame, (x1, max(0, y1 - 25)), (x1 + tw + 10, max(0, y1)), color, -1)
                        cv2.putText(annotated_frame, label, (x1 + 5, max(18, y1 - 7)),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        except Exception as e:
            print(f"[AI] Inference exception: {e}")

        return annotated_frame, detections, has_fire
