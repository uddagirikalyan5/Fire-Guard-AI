# 🔥 FireGuard AI - How to Run Locally

Welcome to **FireGuard AI** (Computer Engineering Final Year Diploma Project).

---

## 🌟 Understanding the Two Available Interfaces

### 1. The Exact Google AI Studio Web Preview (`http://localhost:3000`)
- **What it is:** This is the **exact, interactive system you see in the Google AI Studio preview** (built with React, Tailwind CSS, Lucide icons, and interactive canvas).
- **How to run:**
  - **Option A (No Node.js needed - just Python):**
    ```bash
    python main.py --web
    ```
    *(Or simply double-click `run_web.bat`)*. It opens your browser to `http://localhost:3000` with the **100% identical preview**.
  - **Option B (Using Node.js):**
    ```bash
    npm install
    npm run dev
    ```

---

### 2. The Native Python Desktop Application (`main.py`)
- **What it is:** A native operating system desktop window built in pure Python using **PySide6 (Qt) + Ultralytics YOLOv8 + OpenCV + SQLite**.
- **When to use:** For diploma academic viva, computer engineering lab evaluation, or when your university examiner asks for a `.py` desktop program.
- **How to run:**
  ```bash
  pip install -r requirements.txt
  python main.py --qt
  ```
  *(Or double-click `run_python.bat`)*

---

## 🚀 Quick Start Guide (Windows / Mac / Linux)

### Method A: 1-Click Launch (Windows)
- Double-click **`run_web.bat`** to immediately open the **exact Google AI Studio preview** in your browser.
- Double-click **`run_python.bat`** to run the **native PySide6 desktop GUI**.

---

### Method B: Terminal / Command Prompt

1. **Open your Terminal** inside the project folder.
2. **Install Python requirements:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Launch the application:**
   ```bash
   python main.py
   ```
   *You will see an interactive prompt:*
   ```
   [1] High-Tech Web Console (100% Exact AI Studio Preview)  [RECOMMENDED]
   [2] Native PySide6 Desktop GUI (Pure Python Qt Window)
   ```
   Press **Enter** to open the exact web console in your browser!

---

## 🔑 Default Operator Credentials
- **Username:** `admin`
- **Password:** `admin123`
*(You can also click "Create New Account" to register new operator profiles with Admin or User permissions).*

---

## 🛠️ Project Structure
| File / Folder | Purpose |
| :--- | :--- |
| **`main.py`** | Universal entry point (launches exact web console or PySide6 Qt GUI) |
| **`dist/`** | Pre-built web console assets for instant local browser viewing |
| **`run_web.bat`** | 1-Click launcher for Windows (opens exact web preview) |
| **`run_python.bat`** | 1-Click launcher for Windows (opens PySide6 desktop app) |
| **`requirements.txt`** | Python dependencies (PySide6, OpenCV, Ultralytics YOLOv8, Pygame) |
| **`ui/`** | PySide6 dark GUI modules (`login_window.py` and `main_window.py`) |
| **`database.py`** | SQLite database manager for accounts and fire incident logs |
| **`detector.py`** | YOLOv8 deep learning fire & smoke detection inference engine |
| **`camera.py`** | OpenCV camera capture thread (USB webcam, RTSP, phone streams) |
| **`notifier.py`** | Telegram Bot API integration and local alarm siren |
| **`relay.py`** | USB serial communication for Arduino / ESP32 relay actuation |
| **`arduino/`** | Arduino C++ `.ino` sketch for 3-channel relay & pump control |
| **`src/`** | Source code for the React web application |
