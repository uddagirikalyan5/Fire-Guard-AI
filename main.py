"""
=============================================================================
FireGuard AI - Real-Time Autonomous Fire Detection & Alert System
Computer Engineering Final Year Diploma Project
=============================================================================
Launch Modes:
  1) Web Surveillance Console: 100% identical to the Google AI Studio preview
     Runs local server and opens your web browser automatically.
  2) Native PySide6 Desktop GUI: Native Python Qt desktop application window
     For pure Python academic viva / thesis demonstrations.

Usage:
  python main.py            (Interactive Choice - default is Web Console)
  python main.py --web      (Directly launch 100% exact AI Studio Web Preview)
  python main.py --qt       (Directly launch Native PySide6 Desktop Window)
=============================================================================
"""

import sys
import os
import time
import webbrowser
import threading
import http.server
import socketserver
from pathlib import Path

# Ensure root directory is on Python module path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

def launch_web_console(port=3000):
    """
    Serves the pre-compiled production web build (dist) using Python standard library.
    Guarantees 100% exact visual and functional match with the Google AI Studio preview
    without requiring Node.js to be installed.
    """
    dist_dir = ROOT_DIR / "dist"
    
    # If dist doesn't exist, check if vite build is available
    if not dist_dir.exists():
        print("[Launcher] 'dist' folder not found. Attempting to build with npm...")
        os.system("npm run build")
    
    if not dist_dir.exists() or not (dist_dir / "index.html").exists():
        print("[ERROR] Could not find 'dist/index.html'. Please run 'npm run build' first.")
        print("Falling back to Native PySide6 Desktop application...")
        launch_pyside6_app()
        return

    # Use a custom handler to serve SPA routes correctly
    class SPAHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(dist_dir), **kwargs)

        def log_message(self, format, *args):
            pass # Suppress noisy asset access logs

        def do_GET(self):
            # Check if file exists, if not serve index.html for SPA routing
            path = self.translate_path(self.path)
            if not os.path.exists(path) or os.path.isdir(path):
                self.path = "/index.html"
            return super().do_GET()

    # Find an open port
    active_port = port
    for p in [3000, 3001, 8080, 8000, 5000]:
        try:
            httpd = socketserver.TCPServer(("", p), SPAHandler)
            active_port = p
            break
        except OSError:
            continue
    else:
        httpd = socketserver.TCPServer(("", 0), SPAHandler)
        active_port = httpd.server_address[1]

    url = f"http://localhost:{active_port}"
    print("\n" + "=" * 65)
    print("  🔥 FIREGUARD AI - REAL-TIME WEB CONSOLE (EXACT PREVIEW)")
    print(f"  Local Server URL: {url}")
    print("  Opening Google Chrome / Default Browser automatically...")
    print("  Press Ctrl+C in this terminal window to stop the server.")
    print("=" * 65 + "\n")

    # Open browser in a separate thread after server starts
    def open_browser():
        time.sleep(0.8)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[FireGuard AI] Server stopped by user.")
        httpd.server_close()

def launch_pyside6_app():
    """Launches the native Python PySide6 Qt desktop window."""
    try:
        from PySide6.QtWidgets import QApplication
        from database import DatabaseManager
        from ui.login_window import LoginWindow
        from ui.main_window import MainWindow
    except ImportError as e:
        print(f"\n[ERROR] PySide6 or dependencies not found: {e}")
        print("Please run: pip install -r requirements.txt")
        print("Alternatively, launch the web version with: python main.py --web\n")
        sys.exit(1)

    print("\n" + "=" * 65)
    print("  🔥 FIREGUARD AI - NATIVE PYSIDE6 DESKTOP APPLICATION")
    print("  Computer Engineering Final Year Diploma Project")
    print("=" * 65 + "\n")

    app = QApplication(sys.argv)
    app.setApplicationName("FireGuard AI")
    app.setOrganizationName("Computer Engineering Diploma")

    db_manager = DatabaseManager()
    login_window = LoginWindow(db_manager)
    main_window = None

    def on_login_success(user_data):
        nonlocal main_window
        if isinstance(user_data, dict):
            username = user_data.get("username", "admin")
            role = user_data.get("role", "admin")
        else:
            username = str(user_data)
            role = "admin"
        print(f"[App] Operator '{username}' ({role.upper()}) authenticated successfully.")
        main_window = MainWindow(db_manager, username=username, role=role)
        main_window.show()

    login_window.login_successful.connect(on_login_success)
    login_window.show()

    sys.exit(app.exec())

def main():
    args = sys.argv[1:]

    # Direct flag arguments
    if "--web" in args or "-w" in args:
        launch_web_console()
        return

    if "--qt" in args or "--desktop" in args or "-d" in args:
        launch_pyside6_app()
        return

    # Interactive prompt if executed in terminal without flags
    print("\n" + "=" * 65)
    print("  🔥 FIREGUARD AI - REAL-TIME FIRE SURVEILLANCE SYSTEM")
    print("  Computer Engineering Final Year Diploma Project")
    print("=" * 65)
    print("  Please select the interface to run:")
    print("  [1] High-Tech Web Console (100% Exact AI Studio Preview)  [RECOMMENDED]")
    print("  [2] Native PySide6 Desktop GUI (Pure Python Qt Window)")
    print("=" * 65)

    try:
        choice = input("  Enter choice (1 or 2, default is 1): ").strip()
    except (EOFError, KeyboardInterrupt):
        choice = "1"

    if choice == "2":
        launch_pyside6_app()
    else:
        launch_web_console()

if __name__ == "__main__":
    main()
