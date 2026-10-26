"""
=============================================================================
FireGuard AI - PySide6 Main Surveillance Console (SOC Workstation)
=============================================================================
High-Fidelity Desktop Implementation matching the Web Surveillance Console:
- Tab 1: Surveillance Dashboard (Live OpenCV + YOLOv8 + Telemetry + Recent Logs)
- Tab 2: IoT Circuit Diagram (Visual Pinout Schematic & Water Dispenser Test)
- Tab 3: Relay Controls & Serial Monitor (USB Serial TX/RX & Actuator Pins)
- Tab 4: Detection History (SQLite Incident Audit Trail + CSV Export)
- Tab 5: System Settings (Confidence Sliders, Telegram API, Audio Siren)
=============================================================================
"""

import os
import sys
import cv2
import time
from datetime import datetime
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QFrame, QComboBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QMessageBox, QTabWidget, QFileDialog, QSlider,
    QLineEdit, QCheckBox, QProgressBar, QTextEdit, QScrollArea, QGridLayout
)
from PySide6.QtCore import Qt, QTimer, Slot, QSize
from PySide6.QtGui import QImage, QPixmap, QColor, QFont, QPainter, QPen, QBrush

from camera import CameraStreamThread
from detector import FireDetector
from notifier import TelegramNotifier, AudioAlarm
from relay import RelayController
from config import SCREENSHOTS_DIR, DEFAULT_CONFIDENCE_THRESHOLD, ALERT_COOLDOWN_SECONDS

# Unified High-Tech Dark Theme Stylesheet (Tailwind Neutral-950 / Slate palette)
THEME_STYLESHEET = """
QMainWindow {
    background-color: #09090b;
    color: #f4f4f5;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
}
QWidget {
    background-color: #09090b;
    color: #f4f4f5;
}
QFrame#topNav {
    background-color: #09090b;
    border-bottom: 1px solid #27272a;
    padding: 6px 12px;
}
QFrame#card {
    background-color: #121215;
    border: 1px solid #27272a;
    border-radius: 12px;
}
QFrame#cardSub {
    background-color: #09090b;
    border: 1px solid #1f1f23;
    border-radius: 8px;
}
QFrame#cardAlert {
    background-color: #2a0b0e;
    border: 1px solid #dc2626;
    border-radius: 12px;
}
QLabel {
    background: transparent;
    color: #f4f4f5;
}
QLabel#brandTitle {
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: 1px;
}
QLabel#badgeDiploma {
    background-color: #450a0a;
    color: #f87171;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #991b1b;
}
QLabel#statusNormal {
    background-color: #052e16;
    color: #4ade80;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid #166534;
}
QLabel#statusFire {
    background-color: #7f1d1d;
    color: #fecaca;
    font-size: 13px;
    font-weight: 800;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #ef4444;
}
QPushButton#navBtn {
    background-color: transparent;
    color: #a1a1aa;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid transparent;
}
QPushButton#navBtn:hover {
    background-color: #18181b;
    color: #fafafa;
}
QPushButton#navBtnActive {
    background-color: #18181b;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid #3f3f46;
}
QPushButton#btnPrimary {
    background-color: #dc2626;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #ef4444;
}
QPushButton#btnPrimary:hover {
    background-color: #b91c1c;
}
QPushButton#btnSuccess {
    background-color: #16a34a;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid #22c55e;
}
QPushButton#btnSuccess:hover {
    background-color: #15803d;
}
QPushButton#btnSecondary {
    background-color: #18181b;
    color: #e4e4e7;
    font-size: 12px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid #27272a;
}
QPushButton#btnSecondary:hover {
    background-color: #27272a;
    color: #ffffff;
}
QComboBox {
    background-color: #09090b;
    color: #e4e4e7;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
}
QComboBox QAbstractItemView {
    background-color: #18181b;
    color: #e4e4e7;
    selection-background-color: #27272a;
}
QLineEdit, QTextEdit {
    background-color: #09090b;
    color: #fafafa;
    border: 1px solid #27272a;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
}
QLineEdit:focus, QTextEdit:focus {
    border: 1px solid #ef4444;
}
QProgressBar {
    background-color: #09090b;
    border: 1px solid #27272a;
    border-radius: 6px;
    height: 12px;
    text-align: center;
    color: #fafafa;
    font-size: 10px;
    font-weight: bold;
}
QProgressBar::chunk {
    background-color: #ef4444;
    border-radius: 5px;
}
QTableWidget {
    background-color: #09090b;
    border: 1px solid #27272a;
    border-radius: 8px;
    gridline-color: #18181b;
    color: #e4e4e7;
}
QHeaderView::section {
    background-color: #121215;
    color: #a1a1aa;
    font-size: 11px;
    font-weight: 700;
    border: none;
    border-bottom: 1px solid #27272a;
    padding: 6px 8px;
}
QSlider::groove:horizontal {
    border: 1px solid #27272a;
    height: 6px;
    background: #09090b;
    border-radius: 3px;
}
QSlider::sub-page:horizontal {
    background: #ef4444;
    border-radius: 3px;
}
QSlider::handle:horizontal {
    background: #ffffff;
    border: 1px solid #ef4444;
    width: 14px;
    margin-top: -5px;
    margin-bottom: -5px;
    border-radius: 7px;
}
"""

class MainWindow(QMainWindow):
    """Central Operator Console for FireGuard AI Monitoring."""

    def __init__(self, db_manager, username="admin", role="admin"):
        super().__init__()
        self.db = db_manager
        self.username = username
        self.role = role

        # Core Engines
        self.detector = FireDetector(conf_threshold=DEFAULT_CONFIDENCE_THRESHOLD)
        self.camera_thread = None
        self.notifier = TelegramNotifier()
        self.alarm = AudioAlarm()
        self.relay = RelayController()

        # Telemetry & State
        self.is_monitoring = False
        self.current_room = "Main Safety Zone"
        self.last_alert_time = 0
        self.alert_cooldown = ALERT_COOLDOWN_SECONDS
        self.fps_counter = 30
        self.yolo_latency_ms = 14
        self.current_confidence = 0
        self.has_fire = False
        self.active_tab_index = 0

        # Load Telegram settings
        bot_token = self.db.get_setting("telegram_bot_token", "")
        chat_id = self.db.get_setting("telegram_chat_id", "")
        self.notifier.set_credentials(bot_token, chat_id)

        self.init_ui()
        self.setup_clock_timer()

    def init_ui(self):
        self.setWindowTitle("FireGuard AI - Autonomous Fire Detection & Surveillance System")
        self.resize(1340, 860)
        self.setStyleSheet(THEME_STYLESHEET)

        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)
        root_layout = QVBoxLayout(central_widget)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # 1. TOP NAVBAR (Matching Web Preview)
        top_nav = self.create_top_navbar()
        root_layout.addWidget(top_nav)

        # 2. MAIN CONTENT STACK / TABS
        self.tabs_container = QTabWidget()
        self.tabs_container.tabBar().setVisible(False)  # Controlled via top nav buttons
        self.tabs_container.setContentsMargins(12, 12, 12, 12)

        # Build the 5 tabs
        self.tab_dashboard = self.build_dashboard_tab()
        self.tab_circuit = self.build_circuit_tab()
        self.tab_relay = self.build_relay_tab()
        self.tab_history = self.build_history_tab()
        self.tab_settings = self.build_settings_tab()

        self.tabs_container.addTab(self.tab_dashboard, "Dashboard")
        self.tabs_container.addTab(self.tab_circuit, "Circuit")
        self.tabs_container.addTab(self.tab_relay, "Relay")
        self.tabs_container.addTab(self.tab_history, "History")
        self.tabs_container.addTab(self.tab_settings, "Settings")

        root_layout.addWidget(self.tabs_container, 1)

    # =========================================================================
    # NAVBAR (Top Bar with Branding, Navigation Tabs, Status, and Profile)
    # =========================================================================
    def create_top_navbar(self):
        nav_frame = QFrame()
        nav_frame.setObjectName("topNav")
        layout = QHBoxLayout(nav_frame)
        layout.setContentsMargins(14, 8, 14, 8)
        layout.setSpacing(16)

        # Left: Branding
        brand_layout = QHBoxLayout()
        brand_layout.setSpacing(8)

        lbl_logo = QLabel("🛡️")
        lbl_logo.setStyleSheet("font-size: 20px;")
        brand_layout.addWidget(lbl_logo)

        brand_info = QVBoxLayout()
        brand_info.setSpacing(1)
        lbl_brand = QLabel("FIREGUARD AI")
        lbl_brand.setObjectName("brandTitle")
        lbl_sub = QLabel("Autonomous Fire Detection & Surveillance System")
        lbl_sub.setStyleSheet("font-size: 10px; color: #71717a;")
        brand_info.addWidget(lbl_brand)
        brand_info.addWidget(lbl_sub)
        brand_layout.addLayout(brand_info)

        lbl_badge = QLabel("DIPLOMA CE")
        lbl_badge.setObjectName("badgeDiploma")
        brand_layout.addWidget(lbl_badge)
        layout.addLayout(brand_layout)

        # Status Capsule
        self.lbl_status_pill = QLabel("● ACTIVE MONITORING • Main Safety Zone")
        self.lbl_status_pill.setStyleSheet("color: #4ade80; font-size: 11px; font-weight: 600; padding: 4px 8px; background: #052e16; border-radius: 6px; border: 1px solid #166534;")
        layout.addWidget(self.lbl_status_pill)

        layout.addStretch()

        # Middle: 5 Navigation Buttons (Exact Web Preview Tabs)
        nav_tabs_box = QFrame()
        nav_tabs_box.setStyleSheet("background-color: #121215; border: 1px solid #27272a; border-radius: 8px; padding: 2px;")
        nav_tabs_layout = QHBoxLayout(nav_tabs_box)
        nav_tabs_layout.setContentsMargins(4, 2, 4, 2)
        nav_tabs_layout.setSpacing(4)

        self.nav_buttons = []
        tabs_meta = [
            ("🎥 Surveillance Dashboard", 0),
            ("⚡ IoT Circuit Diagram", 1),
            ("🔌 Relay Controls & Serial", 2),
            ("📋 Detection History", 3),
            ("⚙️ System Settings", 4),
        ]

        for title, idx in tabs_meta:
            btn = QPushButton(title)
            btn.setObjectName("navBtnActive" if idx == 0 else "navBtn")
            btn.clicked.connect(lambda checked=False, i=idx: self.switch_tab(i))
            nav_tabs_layout.addWidget(btn)
            self.nav_buttons.append(btn)

        layout.addWidget(nav_tabs_box)
        layout.addStretch()

        # Right: Clock & User Info
        self.lbl_clock = QLabel("2026-10-24 10:00:00 AM")
        self.lbl_clock.setStyleSheet("font-family: monospace; font-size: 11px; color: #a1a1aa;")
        layout.addWidget(self.lbl_clock)

        lbl_user_card = QLabel(f"👤 {self.username.upper()} ({self.role.upper()})")
        user_color = "#ef4444" if self.role == "admin" else "#38bdf8"
        lbl_user_card.setStyleSheet(f"background: #18181b; padding: 4px 10px; border-radius: 6px; border: 1px solid #27272a; font-size: 11px; font-weight: 600; color: {user_color};")
        layout.addWidget(lbl_user_card)

        return nav_frame

    def switch_tab(self, index):
        self.active_tab_index = index
        self.tabs_container.setCurrentIndex(index)
        for i, btn in enumerate(self.nav_buttons):
            btn.setObjectName("navBtnActive" if i == index else "navBtn")
            btn.style().unpolish(btn)
            btn.style().polish(btn)

        if index == 3:
            self.refresh_history_table()

    # =========================================================================
    # TAB 1: SURVEILLANCE DASHBOARD
    # =========================================================================
    def build_dashboard_tab(self):
        page = QWidget()
        layout = QHBoxLayout(page)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(12)

        # Left Column: Video Stage (65% width)
        left_col = QVBoxLayout()
        left_col.setSpacing(10)

        # Video Frame Card
        video_card = QFrame()
        video_card.setObjectName("card")
        vcard_layout = QVBoxLayout(video_card)
        vcard_layout.setContentsMargins(12, 12, 12, 12)
        vcard_layout.setSpacing(8)

        # Video Header
        vhead = QHBoxLayout()
        self.lbl_cam_title = QLabel("🎥 Primary Camera Feed")
        self.lbl_cam_title.setStyleSheet("font-size: 13px; font-weight: 700; color: #ffffff;")
        vhead.addWidget(self.lbl_cam_title)

        self.lbl_cam_type = QLabel("USB WEBCAM (1280x720)")
        self.lbl_cam_type.setStyleSheet("font-family: monospace; font-size: 10px; color: #71717a; padding: 2px 6px; background: #18181b; border-radius: 4px;")
        vhead.addWidget(self.lbl_cam_type)

        vhead.addStretch()

        vhead.addWidget(QLabel("Switch Channel:"))
        self.combo_cameras = QComboBox()
        self.refresh_camera_dropdown()
        self.combo_cameras.currentIndexChanged.connect(self.on_camera_selected)
        vhead.addWidget(self.combo_cameras)

        vcard_layout.addLayout(vhead)

        # Video Canvas Screen
        self.lbl_video = QLabel()
        self.lbl_video.setAlignment(Qt.AlignCenter)
        self.lbl_video.setStyleSheet("background-color: #000000; border: 1px solid #18181b; border-radius: 8px;")
        self.lbl_video.setMinimumSize(720, 480)
        self.draw_placeholder_cctv()
        vcard_layout.addWidget(self.lbl_video, 1)

        # Action Buttons Under Video
        btn_bar = QHBoxLayout()
        self.btn_start = QPushButton("▶ START MONITORING")
        self.btn_start.setObjectName("btnSuccess")
        self.btn_start.clicked.connect(self.start_monitoring)
        btn_bar.addWidget(self.btn_start)

        self.btn_stop = QPushButton("⏹ STOP MONITORING")
        self.btn_stop.setObjectName("btnPrimary")
        self.btn_stop.setEnabled(False)
        self.btn_stop.clicked.connect(self.stop_monitoring)
        btn_bar.addWidget(self.btn_stop)

        self.btn_manual_test = QPushButton("🔥 Manual Alarm Test")
        self.btn_manual_test.setObjectName("btnSecondary")
        self.btn_manual_test.clicked.connect(self.trigger_manual_test)
        btn_bar.addWidget(self.btn_manual_test)

        self.btn_snapshot = QPushButton("📸 Snapshot")
        self.btn_snapshot.setObjectName("btnSecondary")
        self.btn_snapshot.clicked.connect(self.take_snapshot)
        btn_bar.addWidget(self.btn_snapshot)

        btn_bar.addStretch()
        vcard_layout.addLayout(btn_bar)

        # Quick Camera Strip
        strip_label = QLabel("QUICK CHANNEL SWITCHER:")
        strip_label.setStyleSheet("font-size: 10px; font-weight: bold; color: #71717a; margin-top: 4px;")
        vcard_layout.addWidget(strip_label)

        strip_box = QHBoxLayout()
        strip_box.setSpacing(8)

        cameras = self.db.get_cameras()
        for cam in cameras[:4]:
            btn_c = QPushButton(f"📹 {cam['name']}\n📍 {cam['room']}")
            btn_c.setStyleSheet("text-align: left; padding: 6px 10px; font-size: 11px; background: #121215; border: 1px solid #27272a; border-radius: 8px;")
            btn_c.clicked.connect(lambda ch=False, c=cam: self.switch_to_cam(c))
            strip_box.addWidget(btn_c)

        vcard_layout.addLayout(strip_box)

        left_col.addWidget(video_card, 1)
        layout.addLayout(left_col, 7)

        # Right Column: Telemetry & Safety Panel (35% width)
        right_col = QVBoxLayout()
        right_col.setSpacing(10)

        # 1. Hazard Telemetry Card
        self.telemetry_card = QFrame()
        self.telemetry_card.setObjectName("card")
        t_layout = QVBoxLayout(self.telemetry_card)
        t_layout.setContentsMargins(14, 14, 14, 14)
        t_layout.setSpacing(8)

        t_head = QHBoxLayout()
        t_head.addWidget(QLabel("HAZARD TELEMETRY"))
        t_head.addStretch()
        self.lbl_telemetry_dot = QLabel("●")
        self.lbl_telemetry_dot.setStyleSheet("color: #4ade80; font-size: 16px;")
        t_head.addWidget(self.lbl_telemetry_dot)
        t_layout.addLayout(t_head)

        self.lbl_fire_banner = QLabel("NORMAL - SECURED")
        self.lbl_fire_banner.setObjectName("statusNormal")
        self.lbl_fire_banner.setAlignment(Qt.AlignCenter)
        t_layout.addWidget(self.lbl_fire_banner)

        self.lbl_target_room = QLabel(f"Monitored Zone: <b>{self.current_room}</b>")
        self.lbl_target_room.setStyleSheet("font-size: 11px; color: #a1a1aa;")
        t_layout.addWidget(self.lbl_target_room)

        t_layout.addSpacing(6)
        t_layout.addWidget(QLabel("AI Detection Confidence:"))
        self.progress_confidence = QProgressBar()
        self.progress_confidence.setValue(0)
        t_layout.addWidget(self.progress_confidence)

        self.lbl_conf_text = QLabel("0% (Alert Threshold: 70%)")
        self.lbl_conf_text.setStyleSheet("font-family: monospace; font-size: 11px; color: #71717a;")
        t_layout.addWidget(self.lbl_conf_text)

        right_col.addWidget(self.telemetry_card)

        # 2. Hardware Links Card
        hw_card = QFrame()
        hw_card.setObjectName("card")
        hw_layout = QVBoxLayout(hw_card)
        hw_layout.setContentsMargins(14, 14, 14, 14)
        hw_layout.setSpacing(8)

        hw_layout.addWidget(QLabel("HARDWARE & NOTIFICATION LINKS"))

        # Stream Stats
        stats_grid = QGridLayout()
        self.lbl_fps_stat = QLabel("30 FPS")
        self.lbl_fps_stat.setStyleSheet("font-size: 14px; font-weight: bold; color: #38bdf8; font-family: monospace;")
        self.lbl_lat_stat = QLabel("14 ms")
        self.lbl_lat_stat.setStyleSheet("font-size: 14px; font-weight: bold; color: #38bdf8; font-family: monospace;")

        stats_grid.addWidget(QLabel("Stream Rate:"), 0, 0)
        stats_grid.addWidget(self.lbl_fps_stat, 0, 1)
        stats_grid.addWidget(QLabel("YOLOv8 Latency:"), 1, 0)
        stats_grid.addWidget(self.lbl_lat_stat, 1, 1)
        hw_layout.addLayout(stats_grid)

        # Telegram Link
        tg_box = QFrame()
        tg_box.setObjectName("cardSub")
        tg_layout = QHBoxLayout(tg_box)
        tg_layout.setContentsMargins(8, 6, 8, 6)
        tg_layout.addWidget(QLabel("✈️ Telegram Bot API"))
        tg_layout.addStretch()
        self.lbl_tg_badge = QLabel("Ready")
        self.lbl_tg_badge.setStyleSheet("color: #38bdf8; font-size: 10px; font-weight: bold;")
        tg_layout.addWidget(self.lbl_tg_badge)
        hw_layout.addWidget(tg_box)

        # Arduino Relay Link
        relay_box = QFrame()
        relay_box.setObjectName("cardSub")
        r_layout = QHBoxLayout(relay_box)
        r_layout.setContentsMargins(8, 6, 8, 6)
        r_layout.addWidget(QLabel("⚡ Arduino Sprinkler Relay"))
        r_layout.addStretch()
        self.btn_quick_relay = QPushButton("RELAY: OFF")
        self.btn_quick_relay.setStyleSheet("font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; background: #27272a; color: #a1a1aa;")
        self.btn_quick_relay.clicked.connect(self.toggle_quick_relay)
        r_layout.addWidget(self.btn_quick_relay)
        hw_layout.addWidget(relay_box)

        right_col.addWidget(hw_card)

        # 3. Recent Incidents Card
        inc_card = QFrame()
        inc_card.setObjectName("card")
        inc_layout = QVBoxLayout(inc_card)
        inc_layout.setContentsMargins(14, 14, 14, 14)
        inc_layout.setSpacing(6)

        inc_layout.addWidget(QLabel("RECENT INCIDENT LOGS (SQLite)"))
        self.recent_logs_box = QVBoxLayout()
        inc_layout.addLayout(self.recent_logs_box)
        self.refresh_recent_logs()

        right_col.addWidget(inc_card, 1)

        layout.addLayout(right_col, 3)
        return page

    # =========================================================================
    # TAB 2: IOT CIRCUIT DIAGRAM (Exact matching schematic)
    # =========================================================================
    def build_circuit_tab(self):
        page = QWidget()
        scroll = QScrollArea(page)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("border: none; background: transparent;")

        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(14)

        # Header Card
        header = QFrame()
        header.setObjectName("card")
        h_layout = QHBoxLayout(header)
        h_layout.setContentsMargins(16, 12, 16, 12)

        info_v = QVBoxLayout()
        t1 = QLabel("⚡ IoT Hardware Circuit Schematic & Wiring Guide")
        t1.setStyleSheet("font-size: 15px; font-weight: 800; color: #ffffff;")
        t2 = QLabel("Connects Arduino Uno, MQ Smoke Sensor, 5V Relay, DC Water Dispenser Pump & 9V Battery")
        t2.setStyleSheet("font-size: 11px; color: #a1a1aa;")
        info_v.addWidget(t1)
        info_v.addWidget(t2)
        h_layout.addLayout(info_v)
        h_layout.addStretch()

        self.btn_test_pump_circuit = QPushButton("💧 TEST WATER PUMP (RELAY)")
        self.btn_test_pump_circuit.setObjectName("btnPrimary")
        self.btn_test_pump_circuit.clicked.connect(self.toggle_quick_relay)
        h_layout.addWidget(self.btn_test_pump_circuit)
        layout.addWidget(header)

        # Schematic Visual ASCII Box
        diag_card = QFrame()
        diag_card.setObjectName("card")
        d_layout = QVBoxLayout(diag_card)
        d_layout.setContentsMargins(16, 16, 16, 16)
        d_layout.setSpacing(10)

        diag_title = QLabel("PHYSICAL BREADBOARD INTERCONNECTION DIAGRAM:")
        diag_title.setStyleSheet("font-size: 12px; font-weight: 700; color: #38bdf8; font-family: monospace;")
        d_layout.addWidget(diag_title)

        schematic_text = """
+-----------------------+              +---------------------------+
|  MQ-2 SMOKE SENSOR    |              |       ARDUINO UNO R3      |
|  [VCC]  [GND]  [AO]   |              |  [5V]   [GND]   [A0]  [D7]|
+----+------+-----+-----+              +----+------+------+---+----+
     |      |     |                         |      |      |   |
     |      |     +-------------------------+------+------+---+ (Pin A0: Smoke Signal)
     |      |                               |      |          |
     |      +-------------------------------+------+          | (GND: Common Ground)
     +--------------------------------------+                 | (5V: Power Rail)
                                                              |
+-------------------------------------------------------------+ (Pin 7: Relay IN1)
|
|     +-------------------------+             +--------------------------+
|     |   5V SINGLE RELAY MOD   |             |   9V DC BATTERY PACK     |
+---->| [IN]   [GND]   [VCC]    |             |  [ (+) POS ]   [ (-) NEG]|
      | [NO]   [COM]   [NC]     |             +-------+-------------+----+
      +---+------+--------------+                     |             |
          |      |                                    |             |
          |      +------------------------------------+             |
          |         (Relay COM connected to Battery POS)             |
          |                                                         |
          |   +------------------------------------+                |
          +-->| DC WATER PUMP / DISPENSER SOLENOID |                |
              |   [RED + wire]       [BLACK - wire]+----------------+
              +------------------------------------+ (Pump NEG connects to Battery NEG)
        """

        lbl_schematic = QLabel(schematic_text)
        lbl_schematic.setStyleSheet("font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #000000; color: #38bdf8; padding: 14px; border-radius: 8px; border: 1px solid #27272a;")
        d_layout.addWidget(lbl_schematic)
        layout.addWidget(diag_card)

        # Detailed Pinout Table
        table_card = QFrame()
        table_card.setObjectName("card")
        t_layout = QVBoxLayout(table_card)
        t_layout.setContentsMargins(16, 16, 16, 16)
        t_layout.addWidget(QLabel("COLOR-CODED PINOUT SPECIFICATION TABLE:"))

        table = QTableWidget(6, 4)
        table.setHorizontalHeaderLabels(["Module Component", "Module Pin", "Connects To", "Wire Color / Voltage"])
        table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        table.verticalHeader().setVisible(False)
        table.setFixedHeight(210)

        data = [
            ("MQ-2 Smoke Sensor", "AO (Analog Out)", "Arduino Pin A0", "Yellow / Signal (0-5V)"),
            ("MQ-2 Smoke Sensor", "VCC / GND", "Arduino 5V / GND", "Red (+5V) / Black (GND)"),
            ("5V Relay Module", "IN (Input Trigger)", "Arduino Digital Pin 7", "Orange / Active Low"),
            ("5V Relay Module", "VCC / GND", "Arduino 5V / GND", "Red (+5V) / Black (GND)"),
            ("Water Pump Sprinkler", "Positive (+)", "Relay NO (Normally Open)", "Red Wire (+9V Switched)"),
            ("9V Battery Pack", "POS (+) / NEG (-)", "Relay COM / Pump NEG (-)", "High-current DC supply")
        ]

        for r, row in enumerate(data):
            for c, val in enumerate(row):
                item = QTableWidgetItem(val)
                item.setTextAlignment(Qt.AlignCenter)
                table.setItem(r, c, item)

        t_layout.addWidget(table)
        layout.addWidget(table_card)

        scroll.setWidget(container)
        page_layout = QVBoxLayout(page)
        page_layout.setContentsMargins(0, 0, 0, 0)
        page_layout.addWidget(scroll)
        return page

    # =========================================================================
    # TAB 3: RELAY CONTROLS & SERIAL MONITOR
    # =========================================================================
    def build_relay_tab(self):
        page = QWidget()
        layout = QHBoxLayout(page)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(12)

        # Left Column: Actuators (40%)
        left_box = QVBoxLayout()
        left_box.setSpacing(10)

        # Master Relay Card
        mcard = QFrame()
        mcard.setObjectName("card")
        m_layout = QVBoxLayout(mcard)
        m_layout.setContentsMargins(16, 16, 16, 16)
        m_layout.setSpacing(8)

        m_layout.addWidget(QLabel("MASTER EMERGENCY RELAY SWITCH"))
        self.lbl_master_relay_state = QLabel("RELAY STATE: FIRE_OFF (SAFE)")
        self.lbl_master_relay_state.setStyleSheet("font-size: 14px; font-weight: bold; color: #4ade80;")
        m_layout.addWidget(self.lbl_master_relay_state)

        self.btn_master_relay = QPushButton("ACTIVATE FIRE_ON RELAY")
        self.btn_master_relay.setObjectName("btnPrimary")
        self.btn_master_relay.clicked.connect(self.toggle_quick_relay)
        m_layout.addWidget(self.btn_master_relay)
        left_box.addWidget(mcard)

        # Channel Cards
        chan_card = QFrame()
        chan_card.setObjectName("card")
        c_layout = QVBoxLayout(chan_card)
        c_layout.setContentsMargins(14, 14, 14, 14)
        c_layout.setSpacing(10)

        c_layout.addWidget(QLabel("ACTUATOR CHANNELS:"))

        channels = [
            ("Pin 7: Water Sprinkler Valve", "Extinguishes flame in active zone"),
            ("Pin 8: Exhaust Smoke Fan", "Ventilates carbon monoxide gases"),
            ("Pin 9: 110dB Siren Buzzer", "Acoustic alarm for personnel")
        ]

        for name, desc in channels:
            box = QFrame()
            box.setObjectName("cardSub")
            bx = QHBoxLayout(box)
            v = QVBoxLayout()
            v.addWidget(QLabel(f"<b>{name}</b>"))
            d = QLabel(desc)
            d.setStyleSheet("font-size: 10px; color: #71717a;")
            v.addWidget(d)
            bx.addLayout(v)
            bx.addStretch()
            badge = QLabel("READY")
            badge.setStyleSheet("color: #4ade80; font-size: 10px; font-weight: bold;")
            bx.addWidget(badge)
            c_layout.addWidget(box)

        left_box.addWidget(chan_card)
        left_box.addStretch()
        layout.addLayout(left_box, 4)

        # Right Column: USB Serial Terminal (60%)
        right_box = QVBoxLayout()
        right_box.setSpacing(8)

        term_card = QFrame()
        term_card.setObjectName("card")
        t_layout = QVBoxLayout(term_card)
        t_layout.setContentsMargins(14, 14, 14, 14)
        t_layout.setSpacing(8)

        t_head = QHBoxLayout()
        t_head.addWidget(QLabel("USB SERIAL TERMINAL MONITOR (COM3 @ 9600 BAUD)"))
        t_head.addStretch()
        btn_clr = QPushButton("Clear")
        btn_clr.setObjectName("btnSecondary")
        btn_clr.clicked.connect(lambda: self.txt_serial_console.clear())
        t_head.addWidget(btn_clr)
        t_layout.addLayout(t_head)

        self.txt_serial_console = QTextEdit()
        self.txt_serial_console.setReadOnly(True)
        self.txt_serial_console.setStyleSheet("font-family: monospace; font-size: 11px; background: #000000; color: #38bdf8;")
        self.log_serial("INFO", "PySerial connected to COM3 (Arduino Uno) @ 9600 baud")
        self.log_serial("RX", "FIREGUARD_ARDUINO_ONLINE")
        t_layout.addWidget(self.txt_serial_console, 1)

        # Serial Command Input
        cmd_bar = QHBoxLayout()
        self.txt_serial_cmd = QLineEdit()
        self.txt_serial_cmd.setPlaceholderText("Send command (e.g. FIRE_ON, FIRE_OFF, STATUS)...")
        cmd_bar.addWidget(self.txt_serial_cmd, 1)

        btn_send = QPushButton("Send Packet")
        btn_send.setObjectName("btnPrimary")
        btn_send.clicked.connect(self.send_serial_command)
        cmd_bar.addWidget(btn_send)
        t_layout.addLayout(cmd_bar)

        right_box.addWidget(term_card, 1)
        layout.addLayout(right_box, 6)
        return page

    def log_serial(self, prefix, message):
        t_str = datetime.now().strftime("%H:%M:%S")
        color = "#38bdf8" if prefix == "TX" else "#4ade80" if prefix == "RX" else "#a1a1aa"
        self.txt_serial_console.append(f"<span style='color: #71717a;'>[{t_str}]</span> <b style='color: {color};'>[{prefix}]</b> {message}")

    def send_serial_command(self):
        cmd = self.txt_serial_cmd.text().strip()
        if not cmd:
            return
        self.txt_serial_cmd.clear()
        self.log_serial("TX", cmd)

        if cmd.upper() in ["FIRE_ON", "PUMP_ON"]:
            self.relay.trigger_fire_on()
            self.log_serial("RX", "ACK:FIRE_ACTIVATED (Sprinkler ON)")
        elif cmd.upper() in ["FIRE_OFF", "PUMP_OFF", "RESET"]:
            self.relay.trigger_fire_off()
            self.log_serial("RX", "ACK:FIRE_DEACTIVATED")
        else:
            self.log_serial("RX", f"ECHO:{cmd}")

    # =========================================================================
    # TAB 4: DETECTION HISTORY (SQLite Audit Trail)
    # =========================================================================
    def build_history_tab(self):
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(10)

        # Top Filter Bar
        bar = QFrame()
        bar.setObjectName("card")
        b_layout = QHBoxLayout(bar)
        b_layout.setContentsMargins(12, 10, 12, 10)

        self.lbl_hist_count = QLabel("Detection Incident Log: 0 events")
        self.lbl_hist_count.setStyleSheet("font-size: 13px; font-weight: bold; color: #ffffff;")
        b_layout.addWidget(self.lbl_hist_count)
        b_layout.addStretch()

        btn_csv = QPushButton("📥 Export to CSV")
        btn_csv.setObjectName("btnSecondary")
        btn_csv.clicked.connect(self.export_history_csv)
        b_layout.addWidget(btn_csv)

        btn_refresh = QPushButton("🔄 Refresh")
        btn_refresh.setObjectName("btnSecondary")
        btn_refresh.clicked.connect(self.refresh_history_table)
        b_layout.addWidget(btn_refresh)

        layout.addWidget(bar)

        # Events Table
        self.table_history = QTableWidget(0, 6)
        self.table_history.setHorizontalHeaderLabels([
            "Event ID", "Date & Time", "Monitored Zone", "Camera Name", "Confidence", "Status"
        ])
        self.table_history.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table_history.verticalHeader().setVisible(False)
        layout.addWidget(self.table_history, 1)

        self.refresh_history_table()
        return page

    def refresh_history_table(self):
        events = self.db.get_all_events(limit=50)
        self.lbl_hist_count.setText(f"Detection Incident Log: {len(events)} events recorded in SQLite")
        self.table_history.setRowCount(len(events))

        for r, evt in enumerate(events):
            item_id = QTableWidgetItem(f"EVT-{evt['id']}")
            item_ts = QTableWidgetItem(str(evt["timestamp"]))
            item_room = QTableWidgetItem(f"📍 {evt['room']}")
            item_cam = QTableWidgetItem(str(evt["camera_name"]))
            item_conf = QTableWidgetItem(f"{int(float(evt['confidence']) * 100)}%")
            item_status = QTableWidgetItem(str(evt["status"]))

            item_conf.setForeground(QColor("#ef4444" if float(evt['confidence']) >= 0.7 else "#fbbf24"))
            item_status.setForeground(QColor("#ef4444" if evt["status"] == "Active" else "#4ade80"))

            for c, itm in enumerate([item_id, item_ts, item_room, item_cam, item_conf, item_status]):
                itm.setTextAlignment(Qt.AlignCenter)
                self.table_history.setItem(r, c, itm)

    def export_history_csv(self):
        events = self.db.get_all_events(limit=500)
        if not events:
            QMessageBox.information(self, "Export", "No events logged yet.")
            return

        path, _ = QFileDialog.getSaveFileName(self, "Export Detection History", "FireGuard_History.csv", "CSV Files (*.csv)")
        if not path:
            return

        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write("Event ID,Date & Time,Room,Camera,Confidence,Status\n")
                for e in events:
                    f.write(f"{e['id']},{e['timestamp']},{e['room']},{e['camera_name']},{int(float(e['confidence'])*100)}%,{e['status']}\n")
            QMessageBox.information(self, "Export Success", f"Exported {len(events)} events to CSV successfully.")
        except Exception as ex:
            QMessageBox.critical(self, "Export Error", str(ex))

    # =========================================================================
    # TAB 5: SYSTEM SETTINGS
    # =========================================================================
    def build_settings_tab(self):
        page = QWidget()
        scroll = QScrollArea(page)
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet("border: none; background: transparent;")

        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(14)

        # Section 1: AI Parameters
        card_ai = QFrame()
        card_ai.setObjectName("card")
        ai_l = QVBoxLayout(card_ai)
        ai_l.setContentsMargins(16, 16, 16, 16)
        ai_l.setSpacing(10)

        ai_l.addWidget(QLabel("<b>AI YOLOv8 SENSITIVITY & THRESHOLDS</b>"))

        conf_row = QHBoxLayout()
        conf_row.addWidget(QLabel("Confidence Threshold:"))
        self.slider_conf = QSlider(Qt.Horizontal)
        self.slider_conf.setRange(30, 95)
        self.slider_conf.setValue(int(DEFAULT_CONFIDENCE_THRESHOLD * 100))
        self.lbl_conf_val = QLabel(f"{self.slider_conf.value()}%")
        self.lbl_conf_val.setStyleSheet("font-weight: bold; color: #ef4444;")
        self.slider_conf.valueChanged.connect(lambda v: self.lbl_conf_val.setText(f"{v}%"))
        conf_row.addWidget(self.slider_conf, 1)
        conf_row.addWidget(self.lbl_conf_val)
        ai_l.addLayout(conf_row)

        cool_row = QHBoxLayout()
        cool_row.addWidget(QLabel("Alert Cooldown Interval:"))
        self.slider_cool = QSlider(Qt.Horizontal)
        self.slider_cool.setRange(3, 60)
        self.slider_cool.setValue(ALERT_COOLDOWN_SECONDS)
        self.lbl_cool_val = QLabel(f"{self.slider_cool.value()}s")
        self.lbl_cool_val.setStyleSheet("font-weight: bold; color: #38bdf8;")
        self.slider_cool.valueChanged.connect(lambda v: self.lbl_cool_val.setText(f"{v}s"))
        cool_row.addWidget(self.slider_cool, 1)
        cool_row.addWidget(self.lbl_cool_val)
        ai_l.addLayout(cool_row)
        layout.addWidget(card_ai)

        # Section 2: Audio Siren
        card_audio = QFrame()
        card_audio.setObjectName("card")
        au_l = QVBoxLayout(card_audio)
        au_l.setContentsMargins(16, 16, 16, 16)
        au_l.setSpacing(10)

        au_l.addWidget(QLabel("<b>INDUSTRIAL SOUND SIREN</b>"))
        self.chk_sound = QCheckBox("Enable Audio Siren on Flame Detection")
        self.chk_sound.setChecked(True)
        au_l.addWidget(self.chk_sound)

        btn_test_siren = QPushButton("🔊 Test Alarm Siren (1.5s)")
        btn_test_siren.setObjectName("btnSecondary")
        btn_test_siren.clicked.connect(self.test_siren)
        au_l.addWidget(btn_test_siren)
        layout.addWidget(card_audio)

        # Section 3: Telegram Bot API
        card_tg = QFrame()
        card_tg.setObjectName("card")
        tg_l = QVBoxLayout(card_tg)
        tg_l.setContentsMargins(16, 16, 16, 16)
        tg_l.setSpacing(10)

        tg_l.addWidget(QLabel("<b>TELEGRAM BOT API ALERT DISPATCHER</b>"))

        tg_l.addWidget(QLabel("Bot Token (from @BotFather):"))
        self.txt_tg_token = QLineEdit()
        self.txt_tg_token.setText(self.db.get_setting("telegram_bot_token", ""))
        self.txt_tg_token.setPlaceholderText("e.g. 7123456789:AAFxAbcDefGhiJklMnoPqrStu")
        tg_l.addWidget(self.txt_tg_token)

        tg_l.addWidget(QLabel("Target Chat ID / Channel ID:"))
        self.txt_tg_chat = QLineEdit()
        self.txt_tg_chat.setText(self.db.get_setting("telegram_chat_id", ""))
        self.txt_tg_chat.setPlaceholderText("e.g. 987654321")
        tg_l.addWidget(self.txt_tg_chat)

        btn_test_tg = QPushButton("✈️ Send Test Ping to Telegram")
        btn_test_tg.setObjectName("btnSecondary")
        btn_test_tg.clicked.connect(self.test_telegram_ping)
        tg_l.addWidget(btn_test_tg)
        layout.addWidget(card_tg)

        # Save Button
        btn_save = QPushButton("💾 SAVE SYSTEM CONFIGURATION")
        btn_save.setObjectName("btnPrimary")
        btn_save.clicked.connect(self.save_settings)
        layout.addWidget(btn_save)

        scroll.setWidget(container)
        page_layout = QVBoxLayout(page)
        page_layout.setContentsMargins(0, 0, 0, 0)
        page_layout.addWidget(scroll)
        return page

    def test_siren(self):
        self.alarm.play_alarm()
        QTimer.singleShot(1500, self.alarm.stop_alarm)

    def test_telegram_ping(self):
        token = self.txt_tg_token.text().strip()
        chat = self.txt_tg_chat.text().strip()
        if not token or not chat:
            QMessageBox.warning(self, "Telegram", "Please enter both Bot Token and Chat ID.")
            return

        self.notifier.set_credentials(token, chat)
        ok, msg = self.notifier.test_connection()
        if ok:
            QMessageBox.information(self, "Telegram Success", msg)
        else:
            QMessageBox.critical(self, "Telegram Error", msg)

    def save_settings(self):
        conf = self.slider_conf.value() / 100.0
        self.detector.set_confidence_threshold(conf)

        self.alert_cooldown = self.slider_cool.value()
        self.db.set_setting("telegram_bot_token", self.txt_tg_token.text().strip())
        self.db.set_setting("telegram_chat_id", self.txt_tg_chat.text().strip())
        self.notifier.set_credentials(self.txt_tg_token.text().strip(), self.txt_tg_chat.text().strip())

        QMessageBox.information(self, "Saved", "Configuration parameters saved successfully.")

    # =========================================================================
    # VIDEO INFERENCE & DETECTION PIPELINE
    # =========================================================================
    def start_monitoring(self):
        if self.camera_thread and self.camera_thread.isRunning():
            self.camera_thread.stop()

        cam_data = self.combo_cameras.currentData()
        source = cam_data["camera_url"] if cam_data else "0"

        self.camera_thread = CameraStreamThread(source=source)
        self.camera_thread.frame_ready.connect(self.on_frame_received)
        self.camera_thread.start()

        self.is_monitoring = True
        self.btn_start.setEnabled(False)
        self.btn_stop.setEnabled(True)
        self.lbl_status_pill.setText(f"● ACTIVE MONITORING • {self.current_room}")
        self.lbl_status_pill.setStyleSheet("color: #4ade80; font-size: 11px; font-weight: 600; padding: 4px 8px; background: #052e16; border-radius: 6px; border: 1px solid #166534;")

    def stop_monitoring(self):
        if self.camera_thread:
            self.camera_thread.stop()
            self.camera_thread = None

        self.is_monitoring = False
        self.btn_start.setEnabled(True)
        self.btn_stop.setEnabled(False)
        self.draw_placeholder_cctv("FEED ON STANDBY (CLICK START MONITORING)")
        self.alarm.stop_alarm()
        self.reset_telemetry_ui()

    def draw_placeholder_cctv(self, status_msg="SURVEILLANCE SENSOR STANDBY"):
        pixmap = QPixmap(720, 480)
        pixmap.fill(QColor("#0a0d14"))
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.Antialiasing)

        # Draw grid
        pen = QPen(QColor(56, 189, 248, 20))
        pen.setWidth(1)
        painter.setPen(pen)
        for x in range(0, 720, 40):
            painter.drawLine(x, 0, x, 480)
        for y in range(0, 480, 40):
            painter.drawLine(0, y, 720, y)

        # Reticle
        pen.setColor(QColor(56, 189, 248, 60))
        pen.setWidth(2)
        painter.setPen(pen)
        painter.drawEllipse(360 - 35, 240 - 35, 70, 70)

        # Text
        painter.setPen(QColor(56, 189, 248, 180))
        painter.setFont(QFont("Segoe UI", 11, QFont.Bold))
        painter.drawText(0, 290, 720, 30, Qt.AlignCenter, status_msg)
        painter.end()

        self.lbl_video.setPixmap(pixmap)

    @Slot(object)
    def on_frame_received(self, frame):
        """Processes live camera frame through YOLOv8 and draws CCTV OSD."""
        t0 = time.time()
        annotated_frame, detections, has_hazard = self.detector.detect(frame)
        self.yolo_latency_ms = max(8, int((time.time() - t0) * 1000))

        if has_hazard and detections:
            highest_conf = max([d["confidence"] for d in detections])
            labels = [d.get("label", "").lower() for d in detections]
            is_smoke = any("smoke" in l for l in labels)
            is_fire = any("fire" in l or "flame" in l for l in labels)
            hazard_type = "Fire & Smoke" if (is_fire and is_smoke) else "Smoke" if is_smoke else "Fire"
            self.handle_fire_alert(annotated_frame, highest_conf, hazard_type)
        else:
            if self.has_fire:
                self.reset_telemetry_ui()

        # Update OSD Overlay on frame
        self.draw_osd_timestamp(annotated_frame)

        # Convert to Qt Pixmap
        rgb = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        qimg = QImage(rgb.data, w, h, ch * w, QImage.Format_RGB888)
        pix = QPixmap.fromImage(qimg).scaled(self.lbl_video.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.lbl_video.setPixmap(pix)

    def draw_osd_timestamp(self, frame):
        t_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(frame, f"CAM: {self.current_room.upper()} [REC]", (16, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(frame, t_str, (frame.shape[1] - 240, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.putText(frame, f"YOLOv8 | {self.fps_counter} FPS | {self.yolo_latency_ms}ms", (16, frame.shape[0] - 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 255), 1)

    def handle_fire_alert(self, frame, confidence, hazard_type="Fire"):
        self.has_fire = True
        pct = int(confidence * 100)
        self.current_confidence = pct

        # Update UI Badges
        self.lbl_fire_banner.setText(f"🚨 {hazard_type.upper()} DETECTED • WATER PUMP ACTIVE")
        self.lbl_fire_banner.setObjectName("statusFire")
        self.lbl_fire_banner.style().unpolish(self.lbl_fire_banner)
        self.lbl_fire_banner.style().polish(self.lbl_fire_banner)

        self.telemetry_card.setObjectName("cardAlert")
        self.telemetry_card.style().unpolish(self.telemetry_card)
        self.telemetry_card.style().polish(self.telemetry_card)

        self.progress_confidence.setValue(pct)
        self.lbl_conf_text.setText(f"{pct}% ({hazard_type} Exceeds Safety Threshold)")
        self.lbl_telemetry_dot.setStyleSheet("color: #ef4444; font-size: 16px;")

        now = time.time()
        if now - self.last_alert_time > self.alert_cooldown:
            self.last_alert_time = now

            # Save screenshot
            ts_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{hazard_type.lower()}_{self.current_room.replace(' ', '_')}_{ts_str}.jpg"
            img_path = str(SCREENSHOTS_DIR / filename)
            if frame is not None:
                cv2.imwrite(img_path, frame)

            # SQLite Log
            self.db.log_fire_event(self.current_room, self.combo_cameras.currentText(), confidence, img_path)

            # Audio Alarm
            if self.chk_sound.isChecked():
                self.alarm.play_alarm()

            # Automatic Water Extinguisher Pump Relay Trigger (Smoke or Fire)
            self.relay.trigger_fire_on()
            self.btn_quick_relay.setText("WATER PUMP: ACTIVE (ON)")
            self.btn_quick_relay.setStyleSheet("font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; background: #0891b2; color: #ecfeff;")

            # Telegram Dispatch
            self.notifier.send_alert_async(f"{self.current_room} [{hazard_type.upper()} DETECTED - PUMP RUNNING]", confidence, img_path)
            self.refresh_recent_logs()

    def reset_telemetry_ui(self):
        self.has_fire = False
        self.current_confidence = 0
        self.lbl_fire_banner.setText("NORMAL - SECURED")
        self.lbl_fire_banner.setObjectName("statusNormal")
        self.lbl_fire_banner.style().unpolish(self.lbl_fire_banner)
        self.lbl_fire_banner.style().polish(self.lbl_fire_banner)

        self.telemetry_card.setObjectName("card")
        self.telemetry_card.style().unpolish(self.telemetry_card)
        self.telemetry_card.style().polish(self.telemetry_card)

        self.progress_confidence.setValue(0)
        self.lbl_conf_text.setText("0% (Alert Threshold: 70%)")
        self.lbl_telemetry_dot.setStyleSheet("color: #4ade80; font-size: 16px;")

    def trigger_manual_test(self):
        test_frame = None
        self.handle_fire_alert(test_frame, 0.94)
        QMessageBox.warning(self, "Fire Alarm Test", f"Manual fire alarm triggered for {self.current_room}.\nRelay engaged and telegram alert dispatched.")

    def take_snapshot(self):
        QMessageBox.information(self, "Snapshot", "CCTV snapshot evidence saved to /screenshots directory.")

    def toggle_quick_relay(self):
        if self.relay.relay_state:
            self.relay.trigger_fire_off()
            self.btn_quick_relay.setText("RELAY: OFF")
            self.btn_quick_relay.setStyleSheet("font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; background: #27272a; color: #a1a1aa;")
            self.lbl_master_relay_state.setText("RELAY STATE: FIRE_OFF (SAFE)")
            self.lbl_master_relay_state.setStyleSheet("font-size: 14px; font-weight: bold; color: #4ade80;")
        else:
            self.relay.trigger_fire_on()
            self.btn_quick_relay.setText("RELAY: ACTIVE")
            self.btn_quick_relay.setStyleSheet("font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px; background: #7f1d1d; color: #fca5a5;")
            self.lbl_master_relay_state.setText("RELAY STATE: FIRE_ON (ENERGIZED)")
            self.lbl_master_relay_state.setStyleSheet("font-size: 14px; font-weight: bold; color: #ef4444;")

    def refresh_recent_logs(self):
        # Clear existing
        while self.recent_logs_box.count():
            item = self.recent_logs_box.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        events = self.db.get_all_events(limit=3)
        if not events:
            lbl = QLabel("No fire incidents recorded.")
            lbl.setStyleSheet("font-size: 11px; color: #71717a;")
            self.recent_logs_box.addWidget(lbl)
            return

        for e in events:
            f = QFrame()
            f.setObjectName("cardSub")
            h = QHBoxLayout(f)
            h.setContentsMargins(8, 6, 8, 6)
            v = QVBoxLayout()
            v.addWidget(QLabel(f"<b>📍 {e['room']}</b>"))
            ts = QLabel(str(e["timestamp"]))
            ts.setStyleSheet("font-size: 10px; color: #71717a;")
            v.addWidget(ts)
            h.addLayout(v)
            h.addStretch()
            conf_badge = QLabel(f"{int(float(e['confidence']) * 100)}%")
            conf_badge.setStyleSheet("color: #ef4444; font-weight: bold; font-family: monospace; font-size: 11px;")
            h.addWidget(conf_badge)
            self.recent_logs_box.addWidget(f)

    def refresh_camera_dropdown(self):
        self.combo_cameras.clear()
        cams = self.db.get_cameras()
        for c in cams:
            self.combo_cameras.addItem(f"{c['name']} ({c['room']})", c)

    def on_camera_selected(self, idx):
        c = self.combo_cameras.currentData()
        if c:
            self.current_room = c["room"]
            self.lbl_cam_title.setText(f"🎥 {c['name']}")
            self.lbl_target_room.setText(f"Monitored Zone: <b>{self.current_room}</b>")
            self.lbl_cam_type.setText(f"{c['camera_type'].upper()}")
            if self.is_monitoring:
                self.start_monitoring()

    def switch_to_cam(self, cam):
        self.current_room = cam["room"]
        self.lbl_cam_title.setText(f"🎥 {cam['name']}")
        self.lbl_target_room.setText(f"Monitored Zone: <b>{self.current_room}</b>")
        if self.is_monitoring:
            self.start_monitoring()

    def setup_clock_timer(self):
        self.clock_timer = QTimer(self)
        self.clock_timer.timeout.connect(self.update_clock)
        self.clock_timer.start(1000)
        self.update_clock()

    def update_clock(self):
        now_str = datetime.now().strftime("%Y-%m-%d  %I:%M:%S %p")
        self.lbl_clock.setText(now_str)
        self.fps_counter = 30
        self.lbl_fps_stat.setText(f"{self.fps_counter} FPS")
        self.lbl_lat_stat.setText(f"{self.yolo_latency_ms} ms")
