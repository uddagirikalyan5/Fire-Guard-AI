"""
FireGuard AI - Central Configuration Module
Author: Computer Engineering Diploma Project
Description: Stores default paths, application constants, model parameters, and alert thresholds.
"""

import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
LOGS_DIR = BASE_DIR / "logs"
SCREENSHOTS_DIR = BASE_DIR / "screenshots"
MODELS_DIR = BASE_DIR / "models"
ASSETS_DIR = BASE_DIR / "assets"

# Ensure runtime directories exist
for folder in [LOGS_DIR, SCREENSHOTS_DIR, MODELS_DIR, ASSETS_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# Database Configuration
DATABASE_PATH = BASE_DIR / "fireguard.db"

# AI Model Configuration
DEFAULT_MODEL_NAME = "yolov8n-fire.pt"  # Pretrained YOLOv8 fire detection weights
DEFAULT_MODEL_PATH = MODELS_DIR / DEFAULT_MODEL_NAME
FALLBACK_MODEL_NAME = "yolov8n.pt"     # General YOLOv8 model if custom fire weights not found

# Camera Source Configuration (0=Internal Webcam, 1=External USB, or RTSP/HTTP URL)
DEFAULT_CAMERA_SOURCE = 0              # Change to 1 if you have multiple cameras or run test_camera.py
# Examples:
# DEFAULT_CAMERA_SOURCE = 0            # Default laptop webcam
# DEFAULT_CAMERA_SOURCE = 1            # External USB webcam
# DEFAULT_CAMERA_SOURCE = "http://192.168.1.100:8080/video"  # Phone IP Webcam (Android)
# DEFAULT_CAMERA_SOURCE = "http://192.168.1.50:81/stream"    # ESP32-CAM MJPEG stream

# Detection Parameters
DEFAULT_CONFIDENCE_THRESHOLD = 0.70    # Minimum confidence to trigger fire alarm (70%)
ALERT_COOLDOWN_SECONDS = 10            # Prevent spamming alerts repeatedly within 10s
TARGET_FPS = 30                        # Video processing frame rate target

# Telegram Alert Configuration
DEFAULT_TELEGRAM_BOT_TOKEN = ""        # Fill from BotFather or configure via Settings UI
DEFAULT_TELEGRAM_CHAT_ID = ""          # User/Group Chat ID for receiving alerts

# Arduino Serial Relay Configuration
DEFAULT_SERIAL_PORT = "COM3"           # e.g., 'COM3' on Windows or '/dev/ttyUSB0' on Linux
DEFAULT_BAUD_RATE = 9600
RELAY_COMMAND_FIRE_ON = b"FIRE_ON\n"
RELAY_COMMAND_FIRE_OFF = b"FIRE_OFF\n"

# Default Admin Credentials
DEFAULT_ADMIN_USER = "admin"
DEFAULT_ADMIN_PASS = "admin123"
