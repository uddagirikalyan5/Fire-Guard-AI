"""
FireGuard AI - Video Capture Stream Thread
Description: High-performance threaded camera frame grabber using OpenCV.
Prevents GUI lag by decoding video frames on an independent worker thread.
"""

import cv2
import time
import os
import threading
from PySide6.QtCore import QThread, Signal
import numpy as np

class CameraStreamThread(QThread):
    """
    QThread worker to continuously read frames from a USB webcam or IP RTSP camera.
    Emits raw frames as numpy arrays to the detector and UI.
    """
    frame_ready = Signal(np.ndarray)
    error_occurred = Signal(str)
    connection_status = Signal(bool, str)

    def __init__(self, source="0"):
        super().__init__()
        self.source = source
        self.is_running = False
        self.cap = None

    def set_source(self, source):
        """Change camera source (e.g. integer index 0 or RTSP URL)."""
        self.source = source

    def run(self):
        """Main capture loop running in background thread with auto-discovery."""
        self.is_running = True
        
        # Parse source: if string represents an integer digit, convert to int for OpenCV
        src = self.source
        if isinstance(src, str) and src.isdigit():
            src = int(src)

        print(f"[Camera] Connecting to video source: {src}...")
        self.connection_status.emit(False, "Connecting...")

        try:
            # 1. On Windows, try cv2.CAP_DSHOW for faster startup and hardware compatibility
            if isinstance(src, int) and os.name == 'nt':
                self.cap = cv2.VideoCapture(src, cv2.CAP_DSHOW)
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(src)
            else:
                self.cap = cv2.VideoCapture(src)

            # 2. If index failed and source is an int, auto-scan alternative camera indices (0, 1, 2, 3)
            if (not self.cap or not self.cap.isOpened()) and isinstance(src, int):
                print(f"[Camera Warning] Camera index {src} not accessible. Auto-scanning alternative cameras (0-3)...")
                for candidate in [0, 1, 2, 3]:
                    if candidate == src:
                        continue
                    test_cap = cv2.VideoCapture(candidate, cv2.CAP_DSHOW) if os.name == 'nt' else cv2.VideoCapture(candidate)
                    if test_cap.isOpened():
                        ret, test_frame = test_cap.read()
                        if ret and test_frame is not None:
                            print(f"[Camera Success] Found active camera at index {candidate}! Using it as live feed.")
                            self.cap = test_cap
                            src = candidate
                            break
                        test_cap.release()

            # Set camera buffer size to 1 to reduce stream latency
            if self.cap and self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not self.cap or not self.cap.isOpened():
                err_msg = (
                    f"Failed to open video source: {self.source}. "
                    "Tips: Run 'python test_camera.py' to find working index, "
                    "close other apps using camera (Zoom/Teams), or check permissions."
                )
                print(f"[Camera Error] {err_msg}")
                self.error_occurred.emit(err_msg)
                self.connection_status.emit(False, "Disconnected")
                return

            self.connection_status.emit(True, f"Connected (Cam {src})")
            print(f"[Camera] Video source {src} connected successfully.")

            while self.is_running:
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    # Video stream disconnected or end of file
                    time.sleep(0.1)
                    continue

                # Emit valid frame to listener
                self.frame_ready.emit(frame)
                
                # Small sleep to match ~30 FPS (approx 33ms per frame)
                time.sleep(0.015)

        except Exception as e:
            self.error_occurred.emit(f"Camera Error: {str(e)}")
            self.connection_status.emit(False, "Error")
        finally:
            if self.cap and self.cap.isOpened():
                self.cap.release()
            self.connection_status.emit(False, "Stopped")
            print("[Camera] Capture thread stopped and resources released.")

    def stop(self):
        """Stops the thread gracefully."""
        self.is_running = False
        self.wait(1000)
