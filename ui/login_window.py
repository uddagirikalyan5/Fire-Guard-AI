"""
FireGuard AI - PySide6 High-Fidelity Login & Operator Registration Window
Description: Matches the web preview dark theme (#09090b / #121215), Diploma CE branding,
             operator sign-in, and account registration with role selection.
"""

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QCheckBox, QMessageBox, QFrame, QStackedWidget,
    QScrollArea
)
from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QFont, QCursor

class LoginWindow(QWidget):
    """Modern Dark Glassmorphic Login Window for FireGuard AI Security Personnel."""
    login_successful = Signal(dict)  # Emits authenticated user dict

    def __init__(self, db_manager):
        super().__init__()
        self.db = db_manager
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("FireGuard AI - Operator Authentication Console")
        self.setFixedSize(520, 680)
        self.setStyleSheet("""
            QWidget {
                background-color: #09090b;
                color: #e4e4e7;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            QFrame#card {
                background-color: #121215;
                border: 1px solid #27272a;
                border-radius: 16px;
            }
            QLineEdit {
                background-color: #09090b;
                border: 1px solid #27272a;
                border-radius: 8px;
                padding: 10px 14px;
                font-size: 13px;
                color: #fafafa;
            }
            QLineEdit:focus {
                border: 1px solid #ef4444;
            }
            QCheckBox {
                color: #a1a1aa;
                font-size: 12px;
            }
            QCheckBox::indicator {
                width: 16px;
                height: 16px;
                border-radius: 4px;
                border: 1px solid #3f3f46;
                background-color: #09090b;
            }
            QCheckBox::indicator:checked {
                background-color: #dc2626;
                border-color: #ef4444;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(24, 24, 24, 24)
        main_layout.setSpacing(16)

        # Header Branding matching web preview
        header_frame = QFrame(self)
        h_layout = QVBoxLayout(header_frame)
        h_layout.setContentsMargins(0, 0, 0, 0)
        h_layout.setSpacing(6)
        h_layout.setAlignment(Qt.AlignCenter)

        # Shield Icon Badge
        badge = QLabel("🛡️🔥", self)
        badge.setStyleSheet("""
            background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #dc2626, stop:1 #7f1d1d);
            border: 1px solid rgba(239, 68, 68, 0.4);
            border-radius: 16px;
            padding: 8px 16px;
            font-size: 26px;
        """)
        badge.setAlignment(Qt.AlignCenter)
        h_layout.addWidget(badge, alignment=Qt.AlignCenter)

        title = QLabel("FIREGUARD AI", self)
        title.setStyleSheet("font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 2px;")
        title.setAlignment(Qt.AlignCenter)
        h_layout.addWidget(title)

        subtitle = QLabel("Autonomous Fire Detection & Surveillance System", self)
        subtitle.setStyleSheet("font-size: 12px; color: #a1a1aa;")
        subtitle.setAlignment(Qt.AlignCenter)
        h_layout.addWidget(subtitle)

        # Diploma Badge Capsule
        diploma = QLabel("● Diploma Final Year Project • Computer Engineering", self)
        diploma.setStyleSheet("""
            background-color: #18181b;
            color: #4ade80;
            border: 1px solid #27272a;
            border-radius: 12px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 600;
        """)
        diploma.setAlignment(Qt.AlignCenter)
        h_layout.addWidget(diploma, alignment=Qt.AlignCenter)

        main_layout.addWidget(header_frame)

        # Main Authentication Card
        card = QFrame(self)
        card.setObjectName("card")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(20, 20, 20, 20)
        card_layout.setSpacing(14)

        # Mode Switcher Tabs (Sign In vs Register)
        tabs_bar = QFrame(self)
        tabs_bar.setStyleSheet("background-color: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 2px;")
        tabs_layout = QHBoxLayout(tabs_bar)
        tabs_layout.setContentsMargins(4, 4, 4, 4)
        tabs_layout.setSpacing(6)

        self.btn_tab_login = QPushButton("🔑 Operator Sign In", self)
        self.btn_tab_login.setCursor(QCursor(Qt.PointingHandCursor))
        self.btn_tab_login.setStyleSheet("""
            QPushButton {
                background-color: #dc2626;
                color: #ffffff;
                font-weight: bold;
                font-size: 12px;
                border-radius: 8px;
                padding: 8px;
                border: none;
            }
        """)
        self.btn_tab_login.clicked.connect(self.show_login_tab)
        tabs_layout.addWidget(self.btn_tab_login)

        self.btn_tab_register = QPushButton("👤 Create New Account", self)
        self.btn_tab_register.setCursor(QCursor(Qt.PointingHandCursor))
        self.btn_tab_register.setStyleSheet("""
            QPushButton {
                background-color: transparent;
                color: #a1a1aa;
                font-weight: 600;
                font-size: 12px;
                border-radius: 8px;
                padding: 8px;
                border: none;
            }
            QPushButton:hover {
                color: #ffffff;
            }
        """)
        self.btn_tab_register.clicked.connect(self.show_register_tab)
        tabs_layout.addWidget(self.btn_tab_register)

        card_layout.addWidget(tabs_bar)

        # Stack for Login / Register Views
        self.stack = QStackedWidget(self)

        # PAGE 1: LOGIN FORM
        page_login = QWidget()
        pl_layout = QVBoxLayout(page_login)
        pl_layout.setContentsMargins(0, 0, 0, 0)
        pl_layout.setSpacing(10)

        lbl_u = QLabel("OPERATOR USERNAME", self)
        lbl_u.setStyleSheet("font-size: 11px; font-weight: bold; color: #d4d4d8; letter-spacing: 0.5px;")
        pl_layout.addWidget(lbl_u)

        self.txt_login_user = QLineEdit(self)
        self.txt_login_user.setPlaceholderText("e.g. admin")
        self.txt_login_user.setText("admin")
        pl_layout.addWidget(self.txt_login_user)

        lbl_p = QLabel("PASSWORD", self)
        lbl_p.setStyleSheet("font-size: 11px; font-weight: bold; color: #d4d4d8; letter-spacing: 0.5px;")
        pl_layout.addWidget(lbl_p)

        self.txt_login_pass = QLineEdit(self)
        self.txt_login_pass.setPlaceholderText("••••••••")
        self.txt_login_pass.setEchoMode(QLineEdit.Password)
        self.txt_login_pass.setText("admin123")
        pl_layout.addWidget(self.txt_login_pass)

        # Remember Me + SQLite Auth Label
        rem_row = QHBoxLayout()
        self.chk_rem = QCheckBox("Remember Credentials", self)
        self.chk_rem.setChecked(True)
        rem_row.addWidget(self.chk_rem)
        rem_row.addStretch()
        lbl_sqlite = QLabel("SQLite Local Auth", self)
        lbl_sqlite.setStyleSheet("color: #71717a; font-size: 11px;")
        rem_row.addWidget(lbl_sqlite)
        pl_layout.addLayout(rem_row)

        pl_layout.addSpacing(6)

        # Login Submit Button
        self.btn_do_login = QPushButton("LOGIN TO SURVEILLANCE CONSOLE  ➜", self)
        self.btn_do_login.setCursor(QCursor(Qt.PointingHandCursor))
        self.btn_do_login.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #dc2626, stop:1 #b91c1c);
                color: #ffffff;
                font-weight: 700;
                font-size: 13px;
                border-radius: 10px;
                padding: 12px;
                border: 1px solid rgba(239, 68, 68, 0.4);
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #ef4444, stop:1 #dc2626);
            }
        """)
        self.btn_do_login.clicked.connect(self.handle_login)
        pl_layout.addWidget(self.btn_do_login)

        # Registered Accounts Quick Click / List
        pl_layout.addSpacing(6)
        lbl_reg_ops = QLabel("REGISTERED OPERATORS:", self)
        lbl_reg_ops.setStyleSheet("font-size: 10px; font-weight: bold; color: #71717a; letter-spacing: 0.5px;")
        pl_layout.addWidget(lbl_reg_ops)

        self.users_scroll = QScrollArea(self)
        self.users_scroll.setWidgetResizable(True)
        self.users_scroll.setFixedHeight(90)
        self.users_scroll.setStyleSheet("QScrollArea { border: 1px solid #27272a; border-radius: 8px; background: #09090b; }")
        
        self.users_container = QWidget()
        self.users_container.setStyleSheet("background: #09090b;")
        self.users_layout = QVBoxLayout(self.users_container)
        self.users_layout.setContentsMargins(6, 6, 6, 6)
        self.users_layout.setSpacing(4)
        self.users_scroll.setWidget(self.users_container)
        pl_layout.addWidget(self.users_scroll)

        self.stack.addWidget(page_login)

        # PAGE 2: REGISTER FORM
        page_reg = QWidget()
        pr_layout = QVBoxLayout(page_reg)
        pr_layout.setContentsMargins(0, 0, 0, 0)
        pr_layout.setSpacing(8)

        lbl_fn = QLabel("FULL NAME", self)
        lbl_fn.setStyleSheet("font-size: 11px; font-weight: bold; color: #d4d4d8;")
        pr_layout.addWidget(lbl_fn)
        self.txt_reg_name = QLineEdit(self)
        self.txt_reg_name.setPlaceholderText("Officer Sarah Jenkins")
        pr_layout.addWidget(self.txt_reg_name)

        # Row 2: Email & Mobile
        row_contact = QHBoxLayout()
        v_em = QVBoxLayout()
        v_em.addWidget(QLabel("EMAIL ID", styleSheet="font-size: 10px; font-weight: bold; color: #a1a1aa;"))
        self.txt_reg_email = QLineEdit(self)
        self.txt_reg_email.setPlaceholderText("sarah@fireguard.ai")
        v_em.addWidget(self.txt_reg_email)
        row_contact.addLayout(v_em)

        v_mb = QVBoxLayout()
        v_mb.addWidget(QLabel("MOBILE (FOR TELEGRAM)", styleSheet="font-size: 10px; font-weight: bold; color: #38bdf8;"))
        self.txt_reg_mobile = QLineEdit(self)
        self.txt_reg_mobile.setPlaceholderText("+1 (555) 012-3456")
        v_mb.addWidget(self.txt_reg_mobile)
        row_contact.addLayout(v_mb)
        pr_layout.addLayout(row_contact)

        # Room Name
        lbl_rm = QLabel("ROOM NAME / SECTOR (FREE TEXT)", self)
        lbl_rm.setStyleSheet("font-size: 11px; font-weight: bold; color: #d4d4d8;")
        pr_layout.addWidget(lbl_rm)
        self.txt_reg_room = QLineEdit(self)
        self.txt_reg_room.setPlaceholderText("e.g. Chemical Storage Room 302")
        pr_layout.addWidget(self.txt_reg_room)

        # Row 3: Username & Role
        row_usr = QHBoxLayout()
        v_un = QVBoxLayout()
        v_un.addWidget(QLabel("OPERATOR USERNAME", styleSheet="font-size: 10px; font-weight: bold; color: #a1a1aa;"))
        self.txt_reg_user = QLineEdit(self)
        self.txt_reg_user.setPlaceholderText("sjenkins")
        v_un.addWidget(self.txt_reg_user)
        row_usr.addLayout(v_un)

        v_rl = QVBoxLayout()
        v_rl.addWidget(QLabel("ROLE", styleSheet="font-size: 10px; font-weight: bold; color: #a1a1aa;"))
        self.btn_role_admin = QPushButton("Admin (Full)", self)
        self.btn_role_admin.setCheckable(True)
        self.btn_role_admin.setStyleSheet("QPushButton { background-color: #27272a; color: #fafafa; border-radius: 6px; padding: 6px; } QPushButton:checked { background-color: #dc2626; }")
        self.btn_role_user = QPushButton("User (View)", self)
        self.btn_role_user.setCheckable(True)
        self.btn_role_user.setChecked(True)
        self.btn_role_user.setStyleSheet("QPushButton { background-color: #27272a; color: #fafafa; border-radius: 6px; padding: 6px; } QPushButton:checked { background-color: #0284c7; }")
        
        self.btn_role_admin.clicked.connect(lambda: self.set_reg_role("admin"))
        self.btn_role_user.clicked.connect(lambda: self.set_reg_role("user"))
        
        h_roles = QHBoxLayout()
        h_roles.addWidget(self.btn_role_admin)
        h_roles.addWidget(self.btn_role_user)
        v_rl.addLayout(h_roles)
        row_usr.addLayout(v_rl)
        pr_layout.addLayout(row_usr)

        # Row 4: Password & Confirm
        row_pwd = QHBoxLayout()
        v_p1 = QVBoxLayout()
        v_p1.addWidget(QLabel("PASSWORD", styleSheet="font-size: 10px; font-weight: bold; color: #a1a1aa;"))
        self.txt_reg_p1 = QLineEdit(self)
        self.txt_reg_p1.setEchoMode(QLineEdit.Password)
        self.txt_reg_p1.setPlaceholderText("Min 4 chars")
        v_p1.addWidget(self.txt_reg_p1)
        row_pwd.addLayout(v_p1)

        v_p2 = QVBoxLayout()
        v_p2.addWidget(QLabel("CONFIRM PASSWORD", styleSheet="font-size: 10px; font-weight: bold; color: #a1a1aa;"))
        self.txt_reg_p2 = QLineEdit(self)
        self.txt_reg_p2.setEchoMode(QLineEdit.Password)
        self.txt_reg_p2.setPlaceholderText("Re-enter")
        v_p2.addWidget(self.txt_reg_p2)
        row_pwd.addLayout(v_p2)
        pr_layout.addLayout(row_pwd)

        # Register Submit Button
        self.btn_do_register = QPushButton("REGISTER & ENTER SURVEILLANCE CONSOLE  ➜", self)
        self.btn_do_register.setCursor(QCursor(Qt.PointingHandCursor))
        self.btn_do_register.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #dc2626, stop:1 #b91c1c);
                color: #ffffff;
                font-weight: 700;
                font-size: 12px;
                border-radius: 10px;
                padding: 10px;
                border: 1px solid rgba(239, 68, 68, 0.4);
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #ef4444, stop:1 #dc2626);
            }
        """)
        self.btn_do_register.clicked.connect(self.handle_register)
        pr_layout.addWidget(self.btn_do_register)

        self.stack.addWidget(page_reg)
        card_layout.addWidget(self.stack)

        main_layout.addWidget(card)

        # Footer specs
        footer = QLabel("Python 3.11 • PySide6 Desktop • SQLite Auth • YOLOv8 • OpenCV Multi-Camera", self)
        footer.setStyleSheet("font-size: 11px; color: #71717a;")
        footer.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(footer)

        self.refresh_users_list()

    def set_reg_role(self, role):
        if role == "admin":
            self.btn_role_admin.setChecked(True)
            self.btn_role_user.setChecked(False)
        else:
            self.btn_role_admin.setChecked(False)
            self.btn_role_user.setChecked(True)

    def show_login_tab(self):
        self.btn_tab_login.setStyleSheet("background-color: #dc2626; color: #ffffff; font-weight: bold; font-size: 12px; border-radius: 8px; padding: 8px; border: none;")
        self.btn_tab_register.setStyleSheet("background-color: transparent; color: #a1a1aa; font-weight: 600; font-size: 12px; border-radius: 8px; padding: 8px; border: none;")
        self.stack.setCurrentIndex(0)
        self.refresh_users_list()

    def show_register_tab(self):
        self.btn_tab_register.setStyleSheet("background-color: #dc2626; color: #ffffff; font-weight: bold; font-size: 12px; border-radius: 8px; padding: 8px; border: none;")
        self.btn_tab_login.setStyleSheet("background-color: transparent; color: #a1a1aa; font-weight: 600; font-size: 12px; border-radius: 8px; padding: 8px; border: none;")
        self.stack.setCurrentIndex(1)

    def refresh_users_list(self):
        # Clear existing
        while self.users_layout.count():
            item = self.users_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        users = self.db.get_users()
        if not users:
            empty = QLabel("No registered operators found.", self)
            empty.setStyleSheet("color: #71717a; font-size: 11px;")
            self.users_layout.addWidget(empty)
            return

        for u in users:
            row = QFrame()
            row.setStyleSheet("background-color: #121215; border: 1px solid #27272a; border-radius: 6px; padding: 4px;")
            r_layout = QHBoxLayout(row)
            r_layout.setContentsMargins(6, 4, 6, 4)

            name_lbl = QLabel(f"<b>{u['username']}</b> - {u.get('full_name', 'Operator')}")
            name_lbl.setStyleSheet("color: #e4e4e7; font-size: 11px;")
            r_layout.addWidget(name_lbl)

            r_layout.addStretch()

            role_tag = QLabel(u.get('role', 'user').upper())
            tag_color = "#ef4444" if u.get('role') == 'admin' else "#38bdf8"
            role_tag.setStyleSheet(f"color: {tag_color}; font-weight: bold; font-size: 10px; background-color: #18181b; border: 1px solid {tag_color}; border-radius: 4px; padding: 1px 4px;")
            r_layout.addWidget(role_tag)

            btn_fill = QPushButton("Autofill")
            btn_fill.setCursor(QCursor(Qt.PointingHandCursor))
            btn_fill.setStyleSheet("background-color: #27272a; color: #fafafa; font-size: 10px; border-radius: 4px; padding: 2px 8px;")
            btn_fill.clicked.connect(lambda checked=False, user=u['username']: self.autofill_user(user))
            r_layout.addWidget(btn_fill)

            self.users_layout.addWidget(row)

    def autofill_user(self, username):
        self.txt_login_user.setText(username)
        if username == "admin":
            self.txt_login_pass.setText("admin123")
        else:
            self.txt_login_pass.clear()
            self.txt_login_pass.setFocus()

    def handle_login(self):
        username = self.txt_login_user.text().strip()
        password = self.txt_login_pass.text().strip()

        if not username or not password:
            QMessageBox.warning(self, "Validation Error", "Please provide both username and password.")
            return

        user_data = self.db.authenticate_user(username, password)
        if user_data:
            self.login_successful.emit(user_data)
            self.close()
        else:
            QMessageBox.critical(self, "Access Denied", "Invalid credentials. Please verify username and password.\n(Default: admin / admin123)")

    def handle_register(self):
        name = self.txt_reg_name.text().strip()
        email = self.txt_reg_email.text().strip()
        mobile = self.txt_reg_mobile.text().strip()
        room = self.txt_reg_room.text().strip()
        user = self.txt_reg_user.text().strip().lower()
        p1 = self.txt_reg_p1.text().strip()
        p2 = self.txt_reg_p2.text().strip()
        role = "admin" if self.btn_role_admin.isChecked() else "user"

        if not name or not email or not mobile or not room or not user or not p1:
            QMessageBox.warning(self, "Validation Error", "All fields are required to register an operator.")
            return

        if p1 != p2:
            QMessageBox.warning(self, "Validation Error", "Passwords do not match.")
            return

        if len(p1) < 4:
            QMessageBox.warning(self, "Validation Error", "Password must be at least 4 characters.")
            return

        success = self.db.register_user(
            username=user,
            password=p1,
            full_name=name,
            email=email,
            mobile_number=mobile,
            room_name=room,
            role=role
        )

        if success:
            QMessageBox.information(self, "Account Created", f"Operator account for '{name}' created successfully!\nLogging into surveillance console...")
            user_data = self.db.authenticate_user(user, p1)
            self.login_successful.emit(user_data)
            self.close()
        else:
            QMessageBox.critical(self, "Registration Error", f"Username '{user}' is already registered. Please choose another username.")
