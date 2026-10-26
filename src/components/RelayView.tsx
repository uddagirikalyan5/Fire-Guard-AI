import React, { useState } from 'react';
import {
  Cpu, Terminal, Zap, Power, Shield, CheckCircle2,
  Copy, Download, RefreshCw, AlertCircle, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Wrench, AlertTriangle, FileCode, Sliders
} from 'lucide-react';
import { SerialLog, AppSettings, ArduinoConnectionStatus } from '../types';
import { CircuitDiagramView } from './CircuitDiagramView';

interface RelayViewProps {
  settings: AppSettings;
  arduinoRelayActive: boolean;
  onToggleRelay: (active: boolean) => void;
  serialLogs: SerialLog[];
  onClearLogs: () => void;
  onSendCustomCommand: (cmd: string) => void;
  arduinoStatus?: ArduinoConnectionStatus;
  arduinoPortInfo?: string;
  arduinoLastError?: string;
  onConnectArduino?: () => Promise<boolean>;
  onDisconnectArduino?: () => Promise<void>;
}

const ARDUINO_INO_SKETCH = `/*
 * ==============================================================================
 *  FireGuard AI - Autonomous Fire Suppression & IoT Controller Sketch (.ino)
 *  Compatible with: Arduino Uno (R3 & R4), Nano, Mega 2560, Leonardo, ESP32, etc.
 * ==============================================================================
 *  CRITICAL INSTRUCTIONS FOR ARDUINO IDE:
 *  1. Open Arduino IDE -> File -> New Sketch.
 *  2. Press Ctrl+A (Cmd+A on Mac) and DELETE ALL default text (setup & loop).
 *  3. Paste this entire code into the blank editor.
 *  4. Select Tools -> Board -> Arduino Uno (or Nano / your board).
 *  5. Select Tools -> Port -> (e.g. COM3).
 *  6. Close any app using the COM port (Python app or Serial Monitor) before uploading.
 *  7. Click the Upload button (->).
 * ==============================================================================
 */

// --- PIN DEFINITIONS ---
const int PIN_SMOKE_ANALOG = A0;  // MQ-2 / MQ-135 Smoke & Gas Sensor (Analog)
const int PIN_SMOKE_DIGITAL = 2;  // MQ-2 / MQ-135 Digital Threshold Output (optional)
const int PIN_RELAY_PUMP   = 7;   // Relay IN1: Water Pump / Solenoid Valve
const int PIN_RELAY_FAN    = 8;   // Relay IN2: Ventilation Exhaust Fan
const int PIN_BUZZER       = 9;   // Piezo Buzzer (Active or Passive)
const int PIN_LED_STATUS   = 13;  // Onboard Activity LED

// --- RELAY LOGIC LEVEL (ACTIVE LOW FOR STANDARD 5V RELAYS) ---
// LOW = Relay Energized (Pump ON), HIGH = Relay De-energized (Pump OFF)
const int RELAY_ON  = LOW;
const int RELAY_OFF = HIGH;

// --- SENSOR & TIMING THRESHOLDS ---
const int SMOKE_THRESHOLD = 400;             // Analog threshold (ambient air: 80-250, smoke: > 400)
const unsigned long TELEMETRY_RATE_MS = 2000; // Send telemetry to PC every 2000ms
const unsigned long SIREN_CYCLE_MS    = 180;  // Alternating siren tone cycle

// --- RUNTIME SYSTEM STATE ---
bool isFireActive     = false;
bool isPumpOverride   = false;
bool isFanOverride    = false;
bool isBuzzerOverride = false;
bool sirenPitchHigh   = false;

unsigned long lastTelemetryTime = 0;
unsigned long lastSirenToggle   = 0;
String serialCommandBuffer      = "";

// Universal safe buzzer driver (works seamlessly on AVR, ESP32, ARM)
void activateBuzzer(bool state, bool highPitch) {
  if (state) {
#if defined(ESP32) || defined(ESP8266)
    digitalWrite(PIN_BUZZER, HIGH);
#else
    tone(PIN_BUZZER, highPitch ? 2200 : 1200);
#endif
  } else {
#if defined(ESP32) || defined(ESP8266)
    digitalWrite(PIN_BUZZER, LOW);
#else
    noTone(PIN_BUZZER);
    digitalWrite(PIN_BUZZER, LOW);
#endif
  }
}

// Global alarm trigger or reset
void setFireAlarmState(bool active, const char* origin) {
  isFireActive = active;
  if (active) {
    digitalWrite(PIN_RELAY_PUMP, RELAY_ON);
    digitalWrite(PIN_RELAY_FAN, RELAY_ON);
    digitalWrite(PIN_LED_STATUS, HIGH);
    Serial.print(F("ALERT:FIRE_ACTIVATED:"));
    Serial.println(origin);
  } else {
    isPumpOverride   = false;
    isFanOverride    = false;
    isBuzzerOverride = false;
    digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
    digitalWrite(PIN_RELAY_FAN, RELAY_OFF);
    digitalWrite(PIN_LED_STATUS, LOW);
    activateBuzzer(false, false);
    Serial.println(F("ACK:FIRE_DEACTIVATED"));
  }
}

// Command dispatcher from PC via USB Serial
void processSerialPacket(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "FIRE_ON" || cmd == "FIRE_ALERT") {
    setFireAlarmState(true, "AI_VISION_FIRE");
  } 
  else if (cmd == "FIRE_OFF" || cmd == "RESET" || cmd == "SILENCE") {
    setFireAlarmState(false, "OPERATOR_DISARM");
  } 
  else if (cmd == "PUMP_ON") {
    isPumpOverride = true;
    digitalWrite(PIN_RELAY_PUMP, RELAY_ON);
    Serial.println(F("ACK:PUMP_ON"));
  } 
  else if (cmd == "PUMP_OFF") {
    isPumpOverride = false;
    if (!isFireActive) digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
    Serial.println(F("ACK:PUMP_OFF"));
  } 
  else if (cmd == "FAN_ON") {
    isFanOverride = true;
    digitalWrite(PIN_RELAY_FAN, RELAY_ON);
    Serial.println(F("ACK:FAN_ON"));
  } 
  else if (cmd == "FAN_OFF") {
    isFanOverride = false;
    if (!isFireActive) digitalWrite(PIN_RELAY_FAN, RELAY_OFF);
    Serial.println(F("ACK:FAN_OFF"));
  } 
  else if (cmd == "SIREN_ON" || cmd == "BUZZER_ON") {
    isBuzzerOverride = true;
    activateBuzzer(true, true);
    Serial.println(F("ACK:SIREN_ON"));
  } 
  else if (cmd == "SIREN_OFF" || cmd == "BUZZER_OFF") {
    isBuzzerOverride = false;
    if (!isFireActive) activateBuzzer(false, false);
    Serial.println(F("ACK:SIREN_OFF"));
  } 
  else if (cmd == "STATUS" || cmd == "PING") {
    Serial.print(F("STATUS:ONLINE|SMOKE="));
    Serial.print(analogRead(PIN_SMOKE_ANALOG));
    Serial.print(F("|FIRE="));
    Serial.print(isFireActive ? F("ACTIVE") : F("SECURE"));
    Serial.print(F("|PUMP="));
    Serial.println(digitalRead(PIN_RELAY_PUMP) == RELAY_ON ? F("ON") : F("OFF"));
  }
}

void setup() {
  Serial.begin(9600);
  serialCommandBuffer.reserve(64);

  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_FAN, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_SMOKE_DIGITAL, INPUT);

  // Set initial safe states (Relays OFF)
  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);
  digitalWrite(PIN_LED_STATUS, LOW);
  activateBuzzer(false, false);

  // Ready chirp
  activateBuzzer(true, true);
  delay(100);
  activateBuzzer(false, false);

  Serial.println(F("FIREGUARD_ARDUINO_ONLINE"));
}

void loop() {
  unsigned long now = millis();

  // 1. Non-blocking character serial ingestion
  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    if (ch == '\\n' || ch == '\\r') {
      if (serialCommandBuffer.length() > 0) {
        processSerialPacket(serialCommandBuffer);
        serialCommandBuffer = "";
      }
    } else {
      if (serialCommandBuffer.length() < 60) {
        serialCommandBuffer += ch;
      }
    }
  }

  // 2. Sample smoke sensor
  int smokeLevel = analogRead(PIN_SMOKE_ANALOG);

  // 3. Autonomous smoke trigger
  if (smokeLevel > SMOKE_THRESHOLD && !isFireActive) {
    setFireAlarmState(true, "PHYSICAL_SMOKE_SENSOR");
  }

  // 4. Non-blocking siren oscillation
  if (isFireActive || isBuzzerOverride) {
    if (now - lastSirenToggle >= SIREN_CYCLE_MS) {
      lastSirenToggle = now;
      sirenPitchHigh = !sirenPitchHigh;
      activateBuzzer(true, sirenPitchHigh);
      digitalWrite(PIN_LED_STATUS, sirenPitchHigh ? HIGH : LOW);
    }
  }

  // 5. Periodic telemetry transmission to PC / dashboard
  if (now - lastTelemetryTime >= TELEMETRY_RATE_MS) {
    lastTelemetryTime = now;
    Serial.print(F("DATA:SMOKE="));
    Serial.print(smokeLevel);
    Serial.print(F("|PUMP="));
    Serial.print(digitalRead(PIN_RELAY_PUMP) == RELAY_ON ? F("ON") : F("OFF"));
    Serial.print(F("|FIRE="));
    Serial.println(isFireActive ? F("ACTIVE") : F("SECURE"));
  }
}
`;

export const RelayView: React.FC<RelayViewProps> = ({
  settings,
  arduinoRelayActive,
  onToggleRelay,
  serialLogs,
  onClearLogs,
  onSendCustomCommand,
  arduinoStatus = 'disconnected',
  arduinoPortInfo = '',
  arduinoLastError = '',
  onConnectArduino,
  onDisconnectArduino
}) => {
  const [customCmd, setCustomCmd] = useState('');
  const [copiedIno, setCopiedIno] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [pumpRelay, setPumpRelay] = useState(false);
  const [fanRelay, setFanRelay] = useState(false);
  const [sirenRelay, setSirenRelay] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'circuit' | 'controls'>('circuit');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCmd.trim()) return;
    onSendCustomCommand(customCmd.trim());
    setCustomCmd('');
  };

  const handleCopySketch = () => {
    navigator.clipboard.writeText(ARDUINO_INO_SKETCH);
    setCopiedIno(true);
    setTimeout(() => setCopiedIno(false), 2500);
  };

  const handleDownloadSketch = () => {
    const blob = new Blob([ARDUINO_INO_SKETCH], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fireguard_relay.ino';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isAnyActive = arduinoRelayActive || pumpRelay || fanRelay || sirenRelay;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Header with Live Web Serial Connection State & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-100">
                Arduino Relay & Physical Hardware Actuation
              </h2>
              {/* Connection Status Badge */}
              {arduinoStatus === 'connected' ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/70 font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Arduino Connected
                </span>
              ) : arduinoStatus === 'command_sent' ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500 font-mono font-bold animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Command Sent
                </span>
              ) : arduinoStatus === 'command_failed' ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-600 font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Command Failed
                </span>
              ) : arduinoStatus === 'permission_blocked' ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600 font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Iframe Restricted
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-neutral-950 text-neutral-400 border border-neutral-700 font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                  Arduino Disconnected
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Controls physical 12V water pump, ventilation fan, and buzzer over USB Web Serial (9600 Baud)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs font-mono hidden md:block">
            <span className="text-neutral-400">Device: </span>
            <strong className="text-emerald-300">{arduinoPortInfo || 'Arduino Uno / USB'}</strong>
            <span className="text-neutral-600 mx-1.5">•</span>
            <strong className="text-neutral-200">9600 Baud</strong>
          </div>

          {arduinoStatus === 'connected' || arduinoStatus === 'command_sent' ? (
            <button
              id="btn-relay-view-disconnect"
              type="button"
              onClick={onDisconnectArduino}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-red-300 hover:text-red-200 font-semibold text-xs rounded-xl border border-neutral-700 transition-colors"
            >
              Disconnect USB
            </button>
          ) : (
            <button
              id="btn-relay-view-connect"
              type="button"
              onClick={onConnectArduino}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/60 border border-emerald-400/40 flex items-center gap-1.5 transition-all hover:scale-[1.02]"
            >
              <Zap className="w-4 h-4 text-emerald-200" />
              <span>Connect Arduino (USB)</span>
            </button>
          )}
        </div>
      </div>

      {/* Permission Blocked / Iframe Security Warning Banner */}
      {(arduinoStatus === 'permission_blocked' || arduinoStatus === 'unsupported') && (
        <div className="p-3.5 bg-neutral-950/95 border-2 border-amber-600/80 rounded-2xl text-xs text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-100">Direct USB Serial Access Notice</p>
              <p className="text-[11px] text-neutral-300 mt-0.5">
                {arduinoStatus === 'permission_blocked'
                  ? 'Chrome/Edge blocks Web Serial access inside embedded iframe sandboxes. To connect to your physical COM port directly, open this app in an independent browser window or tab.'
                  : 'Web Serial API requires Google Chrome or Microsoft Edge on Windows, Linux, or macOS.'}
              </p>
            </div>
          </div>
          {onConnectArduino && (
            <button
              onClick={onConnectArduino}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-lg text-xs shrink-0"
            >
              Authorize Port
            </button>
          )}
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl">
        <button
          id="btn-subtab-circuit"
          type="button"
          onClick={() => setActiveSubTab('circuit')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'circuit'
              ? 'bg-neutral-800 text-emerald-300 shadow-md border border-neutral-700 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Simple Circuit Diagram (MQ Sensor + Water Dispenser + Relay + 9V Battery)</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono border border-emerald-800/40">
            Wiring Guide
          </span>
        </button>

        <button
          id="btn-subtab-controls"
          type="button"
          onClick={() => setActiveSubTab('controls')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'controls'
              ? 'bg-neutral-800 text-sky-300 shadow-md border border-neutral-700 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Terminal className="w-4 h-4 text-sky-400" />
          <span>Hardware Controls & Serial Monitor</span>
        </button>
      </div>

      {activeSubTab === 'circuit' ? (
        <CircuitDiagramView
          onTestPump={(active) => onToggleRelay(active)}
          externalPumpActive={arduinoRelayActive}
        />
      ) : (
        /* Main Relay Controls + Serial Terminal */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Relay Switches & Hardware Simulation (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Master Relay Control Card */}
          <div className={`p-5 rounded-2xl border transition-all ${
            arduinoRelayActive
              ? 'bg-red-950/80 border-red-600 shadow-xl shadow-red-950/50'
              : 'bg-neutral-900/90 border-neutral-800'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Master Emergency Relay</span>
              <span className={`w-2.5 h-2.5 rounded-full ${arduinoRelayActive ? 'bg-red-500 animate-ping' : 'bg-neutral-600'}`} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <h3 className="text-lg font-bold font-display text-neutral-100">
                  {arduinoRelayActive ? 'RELAY STATE: FIRE_ON' : 'RELAY STATE: FIRE_OFF'}
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Command: {arduinoRelayActive ? 'FIRE_ON\\n (0x46495245)' : 'FIRE_OFF\\n'}
                </p>
              </div>

              <button
                id="btn-master-relay-toggle"
                onClick={() => onToggleRelay(!arduinoRelayActive)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg ${
                  arduinoRelayActive
                    ? 'bg-red-600 hover:bg-red-500 text-white border border-red-400'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{arduinoRelayActive ? 'TRIGGER FIRE_OFF' : 'TEST FIRE_ON'}</span>
              </button>
            </div>
          </div>

          {/* Individual Actuators Grid */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Actuator Channels (Relay Module)</h4>
            
            {/* Actuator 1: Water Pump Sprinkler */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-200">Pin 7: Water Sprinkler / Solenoid Valve</p>
                <p className="text-[11px] text-neutral-500 font-mono">Suppresses active flame in monitored room</p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded font-mono font-bold ${
                arduinoRelayActive || pumpRelay ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {arduinoRelayActive || pumpRelay ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>

            {/* Actuator 2: Exhaust Ventilation Fan */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-200">Pin 8: Exhaust Smoke Ventilation</p>
                <p className="text-[11px] text-neutral-500 font-mono">Extracts toxic carbon monoxide smoke</p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded font-mono font-bold ${
                arduinoRelayActive || fanRelay ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {arduinoRelayActive || fanRelay ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>

            {/* Actuator 3: Hardware Siren Buzzer */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-200">Pin 9: Piezo 110dB Siren</p>
                <p className="text-[11px] text-neutral-500 font-mono">Local acoustic alarm on ceiling</p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded font-mono font-bold ${
                arduinoRelayActive || sirenRelay ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {arduinoRelayActive || sirenRelay ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>
          </div>

          {/* Arduino Code Download, Copy & Troubleshooting Card */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>Arduino C++ Sketch (.ino)</span>
                </p>
                <p className="text-[11px] text-neutral-400 font-mono">Uno (R3 & R4), Nano, Mega, ESP32</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSketch}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-colors flex items-center gap-1"
                  title="Download fireguard_relay.ino file directly to open in Arduino IDE"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySketch}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow"
                >
                  {copiedIno ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIno ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            {/* Troubleshooting Guide Toggle */}
            <button
              type="button"
              onClick={() => setShowTroubleshoot(!showTroubleshoot)}
              className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 rounded-xl text-xs font-medium text-amber-300 flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Fix Arduino IDE Errors (Troubleshooting Guide)</span>
              </span>
              {showTroubleshoot ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Expandable Troubleshooting Content */}
            {showTroubleshoot && (
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs space-y-3">
                <div className="border-b border-neutral-800/80 pb-2">
                  <p className="font-semibold text-neutral-200 flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Error 1: "redefinition of 'void setup()' / 'void loop()'"</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    <strong>Cause:</strong> In Arduino IDE, <code>File -&gt; New</code> already has an empty <code>setup()</code> and <code>loop()</code>.
                    <br />
                    <strong className="text-emerald-400">Fix:</strong> In Arduino IDE, press <code>Ctrl+A</code> (or <code>Cmd+A</code> on Mac) and press <strong>Delete</strong> to wipe the window completely blank before pasting. Or just click <strong>Download</strong> and open <code>fireguard_relay.ino</code> directly.
                  </p>
                </div>

                <div className="border-b border-neutral-800/80 pb-2">
                  <p className="font-semibold text-neutral-200 flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Error 2: "avrdude: ser_open(): can't open device: Access is denied"</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    <strong>Cause:</strong> The COM port is held open by another program.
                    <br />
                    <strong className="text-emerald-400">Fix:</strong> Close the Python app, Arduino Serial Monitor, or browser WebSerial before clicking Upload. Once uploaded, re-connect.
                  </p>
                </div>

                <div className="border-b border-neutral-800/80 pb-2">
                  <p className="font-semibold text-neutral-200 flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Error 3: "avrdude: stk500_getsync() attempt 1 of 10"</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    <strong>Cause:</strong> Wrong COM port, or if using an Arduino Nano:
                    <br />
                    <strong className="text-emerald-400">Fix:</strong> Go to <strong>Tools -&gt; Processor</strong> and select <em>"ATmega328P (Old Bootloader)"</em>. Also ensure wires on Pin 0 (RX) and Pin 1 (TX) are disconnected during upload.
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-neutral-200 flex items-center gap-1.5 text-sky-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Error 4: Board resets / disconnects when Water Pump turns ON</span>
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                    <strong>Cause:</strong> The water pump draws high DC current causing a brownout reset on the Arduino 5V rail.
                    <br />
                    <strong className="text-emerald-400">Fix:</strong> Power pump with an external 5V-12V power supply. Connect External (+) to Relay COM, Relay NO to Pump (+), and Pump (-) to External (-).
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Serial Terminal Logs (7 cols) */}
        <div className="lg:col-span-7 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                USB Serial Monitor Console ({settings.arduinoComPort} @ {settings.arduinoBaudRate} baud)
              </h3>
            </div>
            <button
              onClick={onClearLogs}
              className="text-[11px] text-neutral-400 hover:text-white px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700 font-mono"
            >
              Clear Logs
            </button>
          </div>

          {/* Terminal Console Box */}
          <div className="flex-1 bg-neutral-950 rounded-xl p-3 font-mono text-xs overflow-y-auto space-y-1.5 border border-neutral-800/80 shadow-inner">
            {serialLogs.length === 0 ? (
              <div className="text-neutral-600 text-center py-10">
                <p>No Serial communication packets logged yet.</p>
                <p className="text-[11px] text-neutral-700 mt-1">Send a command or trigger fire detection to observe real-time TX/RX frames.</p>
              </div>
            ) : (
              serialLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-neutral-600 text-[10px] select-none">{log.timestamp}</span>
                  <span className={`text-[10px] px-1 rounded font-bold ${
                    log.type === 'TX' ? 'bg-sky-950 text-sky-400 border border-sky-900/50' :
                    log.type === 'RX' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' :
                    log.type === 'ERR' ? 'bg-red-950 text-red-400' : 'bg-neutral-800 text-neutral-300'
                  }`}>
                    {log.type}
                  </span>
                  <span className={`${
                    log.type === 'TX' ? 'text-sky-200' :
                    log.type === 'RX' ? 'text-emerald-300 font-semibold' :
                    log.type === 'ERR' ? 'text-red-300' : 'text-neutral-400'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Quick Command Preset Buttons */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-neutral-400 font-mono">Quick Test:</span>
            <button
              type="button"
              id="btn-cmd-quick-fire-on"
              onClick={() => onSendCustomCommand('FIRE_ON')}
              className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 rounded text-[11px] font-mono font-bold transition-colors"
              title="Sends FIRE_ON\n -> Relay Pin 7 Energized -> Water Pump ON"
            >
              FIRE_ON (Pump ON)
            </button>
            <button
              type="button"
              id="btn-cmd-quick-fire-off"
              onClick={() => onSendCustomCommand('FIRE_OFF')}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded text-[11px] font-mono transition-colors"
              title="Sends FIRE_OFF\n -> Relay Pin 7 De-energized -> Water Pump OFF"
            >
              FIRE_OFF (Pump OFF)
            </button>
            <button
              type="button"
              id="btn-cmd-quick-pump-on"
              onClick={() => onSendCustomCommand('PUMP_ON')}
              className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-200 border border-cyan-700/60 rounded text-[11px] font-mono transition-colors"
            >
              PUMP_ON
            </button>
            <button
              type="button"
              id="btn-cmd-quick-pump-off"
              onClick={() => onSendCustomCommand('PUMP_OFF')}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded text-[11px] font-mono transition-colors"
            >
              PUMP_OFF
            </button>
            <button
              type="button"
              id="btn-cmd-quick-status"
              onClick={() => onSendCustomCommand('STATUS')}
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-sky-300 border border-neutral-700 rounded text-[11px] font-mono transition-colors"
            >
              STATUS
            </button>
          </div>

          {/* Serial Command Input Bar */}
          <form onSubmit={handleSend} className="mt-2.5 flex items-center gap-2">
            <input
              type="text"
              value={customCmd}
              onChange={(e) => setCustomCmd(e.target.value)}
              placeholder="Send custom serial command (e.g. FIRE_ON, FIRE_OFF, STATUS)..."
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              id="btn-send-serial-cmd"
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition-colors shadow"
            >
              Send Packet
            </button>
          </form>
        </div>
      </div>
      )}
    </div>
  );
};
