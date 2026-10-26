"""
FireGuard AI - Standalone Camera Scanner & Diagnostic Utility
==============================================================
Usage:
    python test_camera.py                               # Scan all USB webcams 0-5
    python test_camera.py --url http://192.168.1.100:8080/video # Test phone/IP stream
"""

import sys
import os
import cv2
import time
import argparse

def scan_cameras(max_tested=5):
    print("=" * 65)
    print("  🔥 FIREGUARD AI - CAMERA DIAGNOSTIC & HARDWARE SCANNER")
    print("=" * 65)
    print(f"[1/3] Scanning connected camera indices (0 to {max_tested})...\n")

    working_cameras = []
    for idx in range(max_tested + 1):
        print(f"Testing Camera Index [{idx}]...", end=" ", flush=True)
        backend_name = "CAP_DSHOW" if os.name == "nt" else "DEFAULT"
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW) if os.name == "nt" else cv2.VideoCapture(idx)
        
        if not cap.isOpened():
            cap = cv2.VideoCapture(idx)
            backend_name = "DEFAULT"

        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                h, w = frame.shape[:2]
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                print(f"✅ FOUND! ({w}x{h} @ {int(fps)} FPS using {backend_name})")
                working_cameras.append((idx, w, h, fps))
            else:
                print("❌ Opened but no frame received (busy or permission error)")
            cap.release()
        else:
            print("— No device attached")

    print("\n" + "=" * 65)
    print("  📋 SCAN SUMMARY RESULTS")
    print("=" * 65)
    if working_cameras:
        print(f"Total Working Cameras Detected: {len(working_cameras)}")
        for idx, w, h, fps in working_cameras:
            print(f"  ★ Camera Index: {idx} | Resolution: {w}x{h} | FPS: {int(fps)}")
        print(f"\nRecommended action in config.py:")
        print(f"  DEFAULT_CAMERA_SOURCE = {working_cameras[0][0]}")
    else:
        print("⚠️ No functional cameras detected.")
        print("Troubleshooting steps:")
        print("  1. Check Windows Privacy Settings -> Camera -> Allow desktop apps to access camera.")
        print("  2. Ensure other programs (Zoom, Teams, Skype, OBS) are closed.")
        print("  3. Re-plug USB camera or connect phone camera via IP Webcam app.")
    print("=" * 65)

def test_ip_stream(url):
    print(f"\n[Test] Testing Wi-Fi IP / RTSP Stream: {url}...")
    cap = cv2.VideoCapture(url)
    if not cap.isOpened():
        print(f"❌ Failed to open URL. Ensure device is on the SAME Wi-Fi network.")
        return
    ret, frame = cap.read()
    if ret and frame is not None:
        h, w = frame.shape[:2]
        print(f"SUCCESS: Connected! Resolution: {w}x{h}")
    else:
        print("Connected but no video frame received.")
    cap.release()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FireGuard AI Camera Diagnostic Utility")
    parser.add_argument("--url", type=str, help="Test Wi-Fi IP or RTSP camera stream URL", default="")
    args = parser.parse_args()

    if args.url:
        test_ip_stream(args.url)
    else:
        scan_cameras()
