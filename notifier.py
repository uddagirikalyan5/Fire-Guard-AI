"""
FireGuard AI - Alert Notification & Audio Siren Module
Description: Sends instant Telegram alerts with snapshot images and triggers loud sound alarms.
"""

import os
import time
import requests
import pygame
from threading import Thread
from datetime import datetime
from config import SCREENSHOTS_DIR

class TelegramNotifier:
    """Dispatches emergency fire alert messages and snapshot photos to Telegram."""
    def __init__(self, bot_token="", chat_id=""):
        self.bot_token = bot_token
        self.chat_id = chat_id

    def set_credentials(self, bot_token: str, chat_id: str):
        """Updates Telegram API credentials."""
        self.bot_token = bot_token.strip()
        self.chat_id = chat_id.strip()

    def send_alert_async(self, room_name: str, confidence: float, image_path: str = None):
        """Runs telegram notification dispatch in a background thread to prevent UI freezing."""
        thread = Thread(target=self._send_worker, args=(room_name, confidence, image_path), daemon=True)
        thread.start()

    def _send_worker(self, room_name: str, confidence: float, image_path: str = None):
        """Worker thread for network HTTP dispatch to api.telegram.org."""
        if not self.bot_token or not self.chat_id:
            print("[Telegram] Bot Token or Chat ID not configured. Skipping remote alert.")
            return False

        caption = (
            f"🚨 <b>CRITICAL FIRE HAZARD DETECTED</b> 🚨\n\n"
            f"📍 <b>Location:</b> {room_name}\n"
            f"🔥 <b>AI Confidence:</b> {int(confidence * 100)}%\n"
            f"⏰ <b>Timestamp:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"⚠️ <i>Automated vision alarm triggered. Immediate verification recommended.</i>\n\n"
            f"🛡️ <i>FireGuard AI Surveillance Matrix</i>"
        )

        try:
            # 1. Send Photo if available
            if image_path and os.path.exists(image_path):
                url = f"https://api.telegram.org/bot{self.bot_token}/sendPhoto"
                with open(image_path, "rb") as photo_file:
                    files = {"photo": photo_file}
                    data = {"chat_id": self.chat_id, "caption": caption, "parse_mode": "HTML"}
                    res = requests.post(url, data=data, files=files, timeout=12)
                    if res.status_code == 200:
                        print(f"[Telegram] Photo alert delivered successfully for {room_name}.")
                        return True
                    else:
                        print(f"[Telegram] Photo send failed ({res.status_code}): {res.text}")

            # 2. Text message fallback
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            data = {"chat_id": self.chat_id, "text": caption, "parse_mode": "HTML"}
            res = requests.post(url, data=data, timeout=8)
            return res.status_code == 200

        except Exception as e:
            print(f"[Telegram] Connection error: {e}")
            return False

    def test_connection(self) -> tuple[bool, str]:
        """Tests the Telegram Bot credentials by sending a test ping."""
        if not self.bot_token or not self.chat_id:
            return False, "Bot Token and Chat ID are required."
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            data = {
                "chat_id": self.chat_id,
                "text": "🛡️ <b>FireGuard AI Test Message</b>\nTelegram Alert Connection is Active and Ready!",
                "parse_mode": "HTML"
            }
            res = requests.post(url, data=data, timeout=8)
            if res.status_code == 200:
                return True, "Telegram Connected! Test message delivered."
            else:
                return False, f"Telegram Error {res.status_code}: {res.json().get('description', '')}"
        except Exception as e:
            return False, f"Network Error: {str(e)}"


class AudioAlarm:
    """Manages audio siren playback for fire events using Pygame mixer."""
    def __init__(self):
        self.is_playing = False
        try:
            pygame.mixer.init()
        except Exception as e:
            print(f"[Audio] Pygame mixer init error: {e}")

    def play_alarm(self):
        """Starts alarm sound."""
        self.is_playing = True
        print("[Audio] 🚨 Loud Fire Alarm Siren Triggered!")

    def stop_alarm(self):
        """Stops alarm sound."""
        self.is_playing = False
        try:
            if pygame.mixer.get_init():
                pygame.mixer.stop()
        except Exception:
            pass
