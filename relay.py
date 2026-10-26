"""
FireGuard AI - Arduino Relay & Hardware Controller
Description: Communicates with Arduino Uno/Nano over USB Serial to trigger relays, water pumps, or buzzers.
Works safely in fallback mode if no Arduino hardware is connected.
"""

import time
import serial
import serial.tools.list_ports
from config import DEFAULT_SERIAL_PORT, DEFAULT_BAUD_RATE, RELAY_COMMAND_FIRE_ON, RELAY_COMMAND_FIRE_OFF

class RelayController:
    """
    Manages Serial communication with Arduino microcontrollers.
    Sends FIRE_ON and FIRE_OFF commands to control relay switches.
    """
    def __init__(self, port=DEFAULT_SERIAL_PORT, baud_rate=DEFAULT_BAUD_RATE):
        self.port = port
        self.baud_rate = baud_rate
        self.serial_conn = None
        self.is_connected = False
        self.relay_state = False

    @staticmethod
    def list_available_ports():
        """Scans and lists all connected COM / TTY serial ports."""
        ports = serial.tools.list_ports.comports()
        return [f"{p.device} - {p.description}" for p in ports]

    def connect(self, port=None):
        """Establishes USB Serial connection with Arduino."""
        if port:
            self.port = port
        try:
            print(f"[Relay] Connecting to Arduino on port {self.port} at {self.baud_rate} baud...")
            self.serial_conn = serial.Serial(self.port, self.baud_rate, timeout=1)
            time.sleep(2)  # Wait for Arduino bootloader reset
            self.is_connected = True
            print(f"[Relay] Connected to Arduino successfully on {self.port}.")
            return True, "Connected"
        except Exception as e:
            self.is_connected = False
            self.serial_conn = None
            print(f"[Relay] Hardware not connected: {e}. Running in software simulation mode.")
            return False, str(e)

    def trigger_fire_on(self):
        """Sends FIRE_ON command to activate water extinguisher pump (Pin 7)."""
        self.relay_state = True
        if self.is_connected and self.serial_conn:
            try:
                self.serial_conn.write(RELAY_COMMAND_FIRE_ON)
                print("[Relay] Sent Command: FIRE_ON -> Water Extinguisher Pump ACTIVATED (Pin 7)")
            except Exception as e:
                print(f"[Relay] Serial write error: {e}")
        else:
            print("[Relay Local] FIRE_ON command dispatched -> Water Pump ACTIVE (Pin 7)")

    def trigger_smoke_on(self):
        """Sends command to activate water extinguisher pump upon smoke detection."""
        self.relay_state = True
        if self.is_connected and self.serial_conn:
            try:
                self.serial_conn.write(b"SMOKE_ON\n")
                print("[Relay] Sent Command: SMOKE_ON -> Water Extinguisher Pump ACTIVATED (Pin 7)")
            except Exception as e:
                print(f"[Relay] Serial write error: {e}")
        else:
            print("[Relay Local] SMOKE_ON command dispatched -> Water Pump ACTIVE (Pin 7)")

    def trigger_pump_on(self):
        """Explicitly activates the water extinguisher pump."""
        self.relay_state = True
        if self.is_connected and self.serial_conn:
            try:
                self.serial_conn.write(b"PUMP_ON\n")
                print("[Relay] Sent Command: PUMP_ON -> Water Extinguisher Pump ACTIVATED (Pin 7)")
            except Exception as e:
                print(f"[Relay] Serial write error: {e}")
        else:
            print("[Relay Local] PUMP_ON command dispatched -> Water Pump ACTIVE (Pin 7)")

    def trigger_fire_off(self):
        """Sends FIRE_OFF command to turn off relays."""
        self.relay_state = False
        if self.is_connected and self.serial_conn:
            try:
                self.serial_conn.write(RELAY_COMMAND_FIRE_OFF)
                print("[Relay] Sent Command: FIRE_OFF -> Arduino Relay DEACTIVATED")
            except Exception as e:
                print(f"[Relay] Serial write error: {e}")
        else:
            print("[Relay Local] FIRE_OFF command dispatched (Relay Inactive)")

    def disconnect(self):
        """Closes the serial connection."""
        if self.serial_conn and self.serial_conn.is_open:
            self.trigger_fire_off()
            self.serial_conn.close()
        self.is_connected = False
