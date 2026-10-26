"""
FireGuard AI - SQLite Database Manager
Description: Thread-safe database operations for storing users, camera feeds, fire events, and settings.
"""

import sqlite3
import hashlib
from datetime import datetime
from config import DATABASE_PATH, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS

class DatabaseManager:
    """Manages SQLite database connections and schemas for FireGuard AI."""
    
    def __init__(self, db_path=DATABASE_PATH):
        self.db_path = str(db_path)
        self.init_database()

    def get_connection(self):
        """Returns a new SQLite connection with dictionary row formatting."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _hash_password(self, password: str) -> str:
        """Hashes plain text password using SHA-256."""
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    def init_database(self):
        """Initializes tables for Users, Cameras, Events, and Settings."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Users Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT DEFAULT '',
                    email TEXT DEFAULT '',
                    mobile_number TEXT DEFAULT '',
                    room_name TEXT DEFAULT '',
                    role TEXT DEFAULT 'user',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 2. Cameras Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cameras (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    room TEXT NOT NULL,
                    camera_url TEXT NOT NULL,
                    camera_type TEXT NOT NULL, -- 'usb' or 'ip_cctv'
                    is_active INTEGER DEFAULT 1
                )
            """)

            # 3. Fire Events Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room TEXT NOT NULL,
                    camera_name TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    image_path TEXT,
                    status TEXT DEFAULT 'Active', -- 'Active', 'Acknowledged', 'Resolved'
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 4. Settings Table (Key-Value Store)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)

            # Create default admin user if not exists
            cursor.execute("SELECT id FROM users WHERE username = ?", (DEFAULT_ADMIN_USER,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO users (username, password_hash, full_name, email, mobile_number, room_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (DEFAULT_ADMIN_USER, self._hash_password(DEFAULT_ADMIN_PASS), "System Administrator", "admin@fireguard.ai", "+1-555-0199", "Central Command Center", "admin")
                )
                print(f"[DB] Initialized default admin user: {DEFAULT_ADMIN_USER}")

            # Seed default cameras if empty
            cursor.execute("SELECT COUNT(*) as count FROM cameras")
            if cursor.fetchone()["count"] == 0:
                cursor.execute("""
                    INSERT INTO cameras (name, room, camera_url, camera_type, is_active)
                    VALUES 
                    ('Default USB Webcam', 'Main Safety Zone', '0', 'usb', 1),
                    ('Wi-Fi Security Stream', 'Zone B', 'rtsp://192.168.1.100:554/ch0', 'ip_cctv', 1)
                """)
                print("[DB] Initialized camera locations.")

            conn.commit()

    # --- User Authentication & Management ---
    def authenticate_user(self, username: str, password: str):
        """Validates username and hashed password. Returns user dict if valid, else None."""
        hashed = self._hash_password(password)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password_hash = ?", (username.strip(), hashed))
            row = cursor.fetchone()
            return dict(row) if row else None

    def register_user(self, username: str, password: str, full_name: str = "", email: str = "", mobile_number: str = "", room_name: str = "", role: str = "user") -> bool:
        """Registers a new user into the database."""
        try:
            hashed = self._hash_password(password)
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO users (username, password_hash, full_name, email, mobile_number, room_name, role)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (username.strip().lower(), hashed, full_name.strip(), email.strip(), mobile_number.strip(), room_name.strip(), role.strip().lower()))
                conn.commit()
                return True
        except sqlite3.IntegrityError:
            return False

    def get_users(self):
        """Fetches all registered users."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, full_name, email, mobile_number, room_name, role, created_at FROM users ORDER BY id ASC")
            return [dict(row) for row in cursor.fetchall()]

    def delete_user(self, user_id: int) -> bool:
        """Deletes a user by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            return cursor.rowcount > 0

    # --- Fire Events Management ---
    def log_fire_event(self, room: str, camera_name: str, confidence: float, image_path: str = None) -> int:
        """Logs a new fire detection incident to the database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO events (room, camera_name, confidence, image_path, status, timestamp)
                VALUES (?, ?, ?, ?, 'Active', datetime('now', 'localtime'))
            """, (room, camera_name, confidence, image_path))
            conn.commit()
            return cursor.lastrowid

    def get_all_events(self, limit: int = 100):
        """Fetches the latest detection history records."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, room, camera_name, confidence, image_path, status, timestamp 
                FROM events 
                ORDER BY id DESC 
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def update_event_status(self, event_id: int, status: str):
        """Updates event status to Acknowledged or Resolved."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET status = ? WHERE id = ?", (status, event_id))
            conn.commit()

    # --- Camera Management ---
    def get_cameras(self):
        """Fetches all registered cameras."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM cameras WHERE is_active = 1")
            return [dict(row) for row in cursor.fetchall()]

    def add_camera(self, name: str, room: str, camera_url: str, camera_type: str):
        """Registers a new camera."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO cameras (name, room, camera_url, camera_type)
                VALUES (?, ?, ?, ?)
            """, (name, room, camera_url, camera_type))
            conn.commit()

    def delete_camera(self, camera_id: int):
        """Deletes a camera from database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
            conn.commit()

    # --- Settings Key-Value Store ---
    def get_setting(self, key: str, default=None):
        """Retrieves a stored setting."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row["value"] if row else default

    def set_setting(self, key: str, value: str):
        """Saves or updates a setting."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """, (key, str(value)))
            conn.commit()
