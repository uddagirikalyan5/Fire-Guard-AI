import React, { useState } from 'react';
import {
  Cpu, Zap, Droplets, Battery, Flame, CheckCircle2,
  Copy, Download, AlertTriangle, HelpCircle, Power,
  ChevronDown, ChevronUp, RefreshCw, Check, ArrowRight, ShieldCheck,
  Video, Eye, Laptop, Wifi, Radio, Layers, ExternalLink, Terminal
} from 'lucide-react';

export const SIMPLE_ARDUINO_SKETCH = `/*
 * ==============================================================================
 *  FireGuard AI - Simple Smoke Sensor + Water Dispenser Circuit (.ino)
 *  Hardware:
 *    - 1x Arduino Uno (R3 / R4)
 *    - 1x MQ Smoke & Gas Sensor (AO, DO, GND, VCC)
 *    - 1x 5V Single Channel Relay Module (IN, GND, VCC + COM, NO)
 *    - 1x Digital PWM / DC Water Dispenser (Red + , Black -)
 *    - 1x 9V Battery (with clip / wires)
 * ==============================================================================
 *  NO EXTERNAL LIBRARIES REQUIRED - 100% Guaranteed Error-Free Compilation
 * ==============================================================================
 */

// --- PIN ASSIGNMENTS ---
const int PIN_MQ_ANALOG = A0;  // Connect to 'AO' on MQ Smoke Sensor
const int PIN_RELAY     = 7;   // Connect to 'IN' on Relay Module

// --- THRESHOLD CALIBRATION ---
// Normal ambient clean air reads between 70 - 250.
// Smoke or gas will spike reading above 350 - 500.
const int SMOKE_THRESHOLD = 350; 

// --- RELAY LOGIC LEVEL ---
// Standard 5V relay modules are ACTIVE-LOW (LOW = ON / Closed, HIGH = OFF / Open).
// If your relay behaves in reverse, simply swap LOW and HIGH below!
const int RELAY_ON  = LOW;   // Pump ON
const int RELAY_OFF = HIGH;  // Pump OFF

void setup() {
  // Initialize Serial Monitor communication at 9600 baud
  Serial.begin(9600);
  
  // Setup Relay Pin as Output
  pinMode(PIN_RELAY, OUTPUT);
  
  // Guarantee dispenser pump starts in SAFE OFF state
  digitalWrite(PIN_RELAY, RELAY_OFF);
  
  Serial.println(F("================================================"));
  Serial.println(F(" FireGuard: Simple Smoke & Water System Ready! "));
  Serial.println(F(" Warming MQ Sensor (takes 20s to stabilize)...  "));
  Serial.println(F("================================================"));
}

void loop() {
  // 1. Read analog smoke concentration (0 to 1023)
  int smokeValue = analogRead(PIN_MQ_ANALOG);
  
  // 2. Check if smoke crosses safety limit
  bool isSmokeDetected = (smokeValue >= SMOKE_THRESHOLD);
  
  if (isSmokeDetected) {
    // Energize relay -> Water Dispenser sprays water
    digitalWrite(PIN_RELAY, RELAY_ON);
    
    Serial.print(F(">>> ALERT! SMOKE DETECTED! Level: "));
    Serial.print(smokeValue);
    Serial.println(F(" | PUMP: [ON - DISPENSING WATER]"));
  } else {
    // De-energize relay -> Water Dispenser idle
    digitalWrite(PIN_RELAY, RELAY_OFF);
    
    Serial.print(F("Air Normal | Smoke: "));
    Serial.print(smokeValue);
    Serial.println(F(" | Pump: [OFF]"));
  }
  
  // 3. Listen for manual dashboard commands from USB Serial
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    cmd.toUpperCase();
    
    if (cmd == "PUMP_ON" || cmd == "FIRE_ON") {
      digitalWrite(PIN_RELAY, RELAY_ON);
      Serial.println(F("MANUAL OVERRIDE: Dispenser forced ON"));
    } else if (cmd == "PUMP_OFF" || cmd == "FIRE_OFF" || cmd == "RESET") {
      digitalWrite(PIN_RELAY, RELAY_OFF);
      Serial.println(F("MANUAL OVERRIDE: Dispenser forced OFF"));
    }
  }

  // Delay 400ms for stable, smooth sampling
  delay(400);
}
`;

export const ESP32_CAM_SKETCH = `/*
 * ==============================================================================
 *  FireGuard AI - ESP32-CAM Wi-Fi Camera Video Server (.ino)
 *  Hardware: ESP32-CAM AI-Thinker Module with OV2640 Lens
 *
 *  FTDI Programmer to ESP32-CAM Wiring:
 *    FTDI 5V   <---> ESP32-CAM 5V
 *    FTDI GND  <---> ESP32-CAM GND
 *    FTDI TX   <---> ESP32-CAM U0R (RX)
 *    FTDI RX   <---> ESP32-CAM U0T (TX)
 *    GPIO 0    <---> GND (CONNECT during upload; DISCONNECT to run stream!)
 * ==============================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// --- REPLACE WITH YOUR LOCAL WI-FI NETWORK ---
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// AI-Thinker ESP32-CAM Pin Definitions
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

httpd_handle_t stream_httpd = NULL;

static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;

  res = httpd_resp_set_type(req, "multipart/x-mixed-replace;boundary=123456789000000000000987654321");
  if(res != ESP_OK) return res;

  while(true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      delay(20);
      continue;
    }
    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;

    res = httpd_resp_send_chunk(req, "\\r\\n--123456789000000000000987654321\\r\\nContent-Type: image/jpeg\\r\\nContent-Length: ", strlen("\\r\\n--123456789000000000000987654321\\r\\nContent-Type: image/jpeg\\r\\nContent-Length: "));
    if(res != ESP_OK) { esp_camera_fb_return(fb); break; }
    char len_str[16];
    sprintf(len_str, "%u\\r\\n\\r\\n", _jpg_buf_len);
    res = httpd_resp_send_chunk(req, len_str, strlen(len_str));
    if(res != ESP_OK) { esp_camera_fb_return(fb); break; }
    res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    esp_camera_fb_return(fb);
    if(res != ESP_OK) break;
  }
  return res;
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  httpd_uri_t stream_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
  }
}

void setup() {
  Serial.begin(115200);
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_VGA;
  config.jpeg_quality = 12;
  config.fb_count = 2;

  esp_camera_init(&config);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Camera Stream Live at: http://");
  Serial.println(WiFi.localIP());
  startCameraServer();
}

void loop() {
  delay(10000);
}
`;

export const ESP_WIFI_NODE_SKETCH = `/*
 * ==============================================================================
 *  FireGuard AI - ESP8266 / NodeMCU Wireless IoT Sensor & Relay Node (.ino)
 *  Hardware: ESP8266 NodeMCU or ESP32 DevKit
 *    - MQ Smoke Sensor: AO -> A0
 *    - 5V Relay IN: D1 (GPIO 5)
 *    - Active Buzzer: D2 (GPIO 4)
 *    - Autonomous Wi-Fi Telemetry & Emergency Trigger
 * ==============================================================================
 */

#include <ESP8266WiFi.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const int PIN_MQ_ANALOG = A0;  // Analog smoke reading
const int PIN_RELAY     = 5;   // D1 / GPIO 5
const int PIN_BUZZER    = 4;   // D2 / GPIO 4

const int SMOKE_THRESHOLD = 380;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_RELAY, HIGH); // Relay OFF (Active LOW)
  digitalWrite(PIN_BUZZER, LOW);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  int smoke = analogRead(PIN_MQ_ANALOG);
  Serial.printf("Smoke Concentration: %d / 1023\\n", smoke);

  if (smoke >= SMOKE_THRESHOLD) {
    digitalWrite(PIN_RELAY, LOW);   // Water Pump ON
    digitalWrite(PIN_BUZZER, HIGH); // Siren ON
    Serial.println(">>> CRITICAL FIRE HAZARD: Water Dispenser Engaged!");
  } else {
    digitalWrite(PIN_RELAY, HIGH);  // Water Pump OFF
    digitalWrite(PIN_BUZZER, LOW);  // Siren OFF
  }
  delay(400);
}
`;

interface CircuitDiagramViewProps {
  onTestPump?: (active: boolean) => void;
  externalPumpActive?: boolean;
}

export const CircuitDiagramView: React.FC<CircuitDiagramViewProps> = ({
  onTestPump,
  externalPumpActive = false
}) => {
  // IoT System Subtab: 'arduino_dispenser' | 'esp32_cam' | 'esp8266_node' | 'full_architecture'
  const [selectedIoTTab, setSelectedIoTTab] = useState<'arduino_dispenser' | 'esp32_cam' | 'esp8266_node' | 'full_architecture'>('arduino_dispenser');

  const [simulatedSmoke, setSimulatedSmoke] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [relayActiveState, setRelayActiveState] = useState<boolean>(false);

  // Active state: either simulated smoke, manual test, or external relay trigger
  const isDispensing = simulatedSmoke || relayActiveState || externalPumpActive;
  const currentSmokeValue = simulatedSmoke ? 580 : 125;

  const handleToggleSmoke = () => {
    setSimulatedSmoke(prev => !prev);
  };

  const handleToggleRelay = () => {
    const newState = !relayActiveState;
    setRelayActiveState(newState);
    if (onTestPump) {
      onTestPump(newState);
    }
  };

  const currentSketch =
    selectedIoTTab === 'esp32_cam'
      ? ESP32_CAM_SKETCH
      : selectedIoTTab === 'esp8266_node'
      ? ESP_WIFI_NODE_SKETCH
      : SIMPLE_ARDUINO_SKETCH;

  const currentSketchName =
    selectedIoTTab === 'esp32_cam'
      ? 'esp32_cam_wifi_stream.ino'
      : selectedIoTTab === 'esp8266_node'
      ? 'esp8266_wifi_fireguard.ino'
      : 'fireguard_simple_smoke_dispenser.ino';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentSketch);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDownloadIno = () => {
    const blob = new Blob([currentSketch], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentSketchName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Quick Summary & IoT Device Subtabs */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 text-xs font-semibold font-mono">
                Verified Hardware Schematics
              </span>
              <span className="text-xs text-neutral-400">| Complete IoT Pinouts & Wiring</span>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-neutral-100 font-display">
              IoT Hardware Circuit Diagrams & Pinout Guides
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-3xl leading-relaxed">
              Step-by-step schematics and wiring connections for your IoT sensors, Wi-Fi camera modules, 5V relays, microcontrollers, and DC actuators.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleToggleSmoke}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                simulatedSmoke
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              }`}
            >
              <Flame className={`w-4 h-4 ${simulatedSmoke ? 'text-amber-200 animate-bounce' : 'text-neutral-400'}`} />
              <span>{simulatedSmoke ? 'Clear Smoke (Test)' : 'Simulate Smoke'}</span>
            </button>

            <button
              onClick={handleToggleRelay}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                isDispensing
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
              }`}
            >
              <Power className="w-4 h-4 text-sky-300" />
              <span>{isDispensing ? 'Dispenser RUNNING' : 'Test Water Dispenser'}</span>
            </button>
          </div>
        </div>

        {/* Real-time interactive status pill */}
        <div className="mt-4 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">MQ Sensor (A0):</span>
            <span className={`font-bold px-2 py-0.5 rounded ${
              currentSmokeValue > 350 ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-neutral-800 text-emerald-400'
            }`}>
              {currentSmokeValue} / 1023
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Relay (Pin 7):</span>
            <span className={`font-bold px-2 py-0.5 rounded ${
              isDispensing ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'
            }`}>
              {isDispensing ? 'CLOSED (9V LOAD ENERGIZED)' : 'OPEN (STANDBY)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Water Dispenser:</span>
            <span className={`font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
              isDispensing ? 'bg-sky-950 text-sky-300 border border-sky-800 animate-pulse' : 'bg-neutral-800 text-neutral-400'
            }`}>
              <Droplets className="w-3 h-3" />
              {isDispensing ? 'ACTIVE PUMPING' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>

      {/* IoT Device Schematics Selector Bar */}
      <div className="flex items-center gap-2 p-1.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setSelectedIoTTab('arduino_dispenser')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all ${
            selectedIoTTab === 'arduino_dispenser'
              ? 'bg-neutral-800 text-emerald-300 shadow border border-neutral-700 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>1. Arduino + Relay + Water Dispenser + MQ Sensor</span>
        </button>

        <button
          onClick={() => setSelectedIoTTab('esp32_cam')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all ${
            selectedIoTTab === 'esp32_cam'
              ? 'bg-neutral-800 text-sky-300 shadow border border-neutral-700 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Wifi className="w-4 h-4 text-sky-400" />
          <span>2. ESP32-CAM Wi-Fi Camera IoT Circuit</span>
        </button>

        <button
          onClick={() => setSelectedIoTTab('esp8266_node')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all ${
            selectedIoTTab === 'esp8266_node'
              ? 'bg-neutral-800 text-amber-300 shadow border border-neutral-700 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Radio className="w-4 h-4 text-amber-400" />
          <span>3. ESP8266 / ESP32 Wireless Sensor Node</span>
        </button>

        <button
          onClick={() => setSelectedIoTTab('full_architecture')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition-all ${
            selectedIoTTab === 'full_architecture'
              ? 'bg-neutral-800 text-red-300 shadow border border-neutral-700 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Layers className="w-4 h-4 text-red-400" />
          <span>4. Full AI + IoT End-to-End Pipeline</span>
        </button>
      </div>

      {/* TAB 1: ARDUINO UNO + MQ SENSOR + RELAY + WATER DISPENSER + 9V BATTERY */}
      {selectedIoTTab === 'arduino_dispenser' && (
        <div className="space-y-6">
          {/* Visual Interactive Circuit Diagram (Schematic Representation) */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                  Interactive Schematic & Live Wiring Map
                </h3>
              </div>
              <span className="text-xs text-neutral-400 font-mono">Current flows when relay trips</span>
            </div>

            {/* Circuit Diagram Canvas / Grid */}
            <div className="relative bg-neutral-950 rounded-xl p-6 border border-neutral-800 overflow-x-auto min-w-[700px]">
              <div className="grid grid-cols-12 gap-4 items-center">
                {/* 1. MQ Smoke Sensor Block (Cols 1-3) */}
                <div className={`col-span-3 p-4 rounded-xl border transition-all ${
                  currentSmokeValue > 350
                    ? 'bg-amber-950/60 border-amber-500 shadow-lg shadow-amber-950/40'
                    : 'bg-neutral-900 border-neutral-700'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      MQ Smoke Sensor
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      currentSmokeValue > 350 ? 'bg-amber-500 text-black font-bold' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {currentSmokeValue > 350 ? 'SMOKE' : 'CLEAN'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mb-3">Smoke / Gas Detection</p>

                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="flex items-center justify-between px-2 py-1 bg-neutral-950 rounded border border-neutral-800">
                      <span className="text-red-400 font-bold">VCC</span>
                      <span className="text-neutral-400">→ +5V Uno</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 bg-neutral-950 rounded border border-neutral-800">
                      <span className="text-neutral-400 font-bold">GND</span>
                      <span className="text-neutral-400">→ GND Uno</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 bg-emerald-950/60 rounded border border-emerald-800/80">
                      <span className="text-emerald-400 font-bold">AO</span>
                      <span className="text-emerald-300">→ Pin A0 Uno</span>
                    </div>
                  </div>
                </div>

                {/* 2. Central Arduino Uno Controller (Cols 4-7) */}
                <div className="col-span-4 p-4 bg-sky-950/30 rounded-xl border border-sky-800/60 shadow-lg relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-bold text-sky-200">Arduino Uno R3</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-900/60 text-sky-300 font-mono">
                      USB 5V Powered
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mb-3">Microcontroller Core</p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="space-y-1.5 bg-neutral-950/80 p-2 rounded border border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Power / Analog</div>
                      <div className="text-red-400">● 5V (Sensor & Relay)</div>
                      <div className="text-neutral-400">● GND (Common)</div>
                      <div className="text-emerald-400 font-bold">● A0 (MQ Sensor)</div>
                    </div>

                    <div className="space-y-1.5 bg-neutral-950/80 p-2 rounded border border-neutral-800">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase">Digital Pins</div>
                      <div className={`font-bold transition-colors ${isDispensing ? 'text-amber-400' : 'text-neutral-300'}`}>
                        ● Pin 7 (Relay IN)
                      </div>
                      <div className="text-neutral-500">● USB (Serial 9600)</div>
                    </div>
                  </div>

                  <div className="mt-3 text-[10px] text-sky-300/80 bg-sky-950/80 px-2 py-1 rounded border border-sky-800/40 font-mono">
                    ⚡ Reads A0 every 400ms. If A0 &gt; 350 or serial 'FIRE_ON', toggles Pin 7 to LOW.
                  </div>
                </div>

                {/* 3. 5V Relay Module Block (Cols 8-9) */}
                <div className={`col-span-2 p-3 rounded-xl border transition-all ${
                  isDispensing
                    ? 'bg-emerald-950/70 border-emerald-500 shadow-lg shadow-emerald-950/40'
                    : 'bg-neutral-900 border-neutral-700'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-200">Relay Module</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${isDispensing ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                  </div>
                  <p className="text-[10px] text-neutral-400 mb-2">Optocoupled Switch</p>

                  <div className="text-[10px] font-mono space-y-1 mb-2 bg-neutral-950 p-1.5 rounded border border-neutral-800">
                    <div className="text-neutral-500 font-bold uppercase text-[9px]">Input Pins</div>
                    <div className="text-red-400">VCC → 5V</div>
                    <div className="text-neutral-400">GND → GND</div>
                    <div className="text-amber-300 font-bold">IN  → Pin 7</div>
                  </div>

                  <div className="text-[10px] font-mono space-y-1 bg-neutral-950 p-1.5 rounded border border-neutral-800">
                    <div className="text-neutral-500 font-bold uppercase text-[9px]">Screw Terminals</div>
                    <div className="text-sky-400 font-bold">COM → 9V Bat (+)</div>
                    <div className="text-red-400 font-bold">NO  → Pump (+)</div>
                  </div>
                </div>

                {/* 4. Power & Actuator Load: 9V Battery & Water Dispenser (Cols 10-12) */}
                <div className="col-span-3 space-y-2">
                  <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Battery className="w-5 h-5 text-amber-400" />
                      <div>
                        <p className="text-xs font-bold text-neutral-200">9V Battery</p>
                        <p className="text-[10px] text-neutral-400">External Motor Power</p>
                      </div>
                    </div>
                    <div className="text-right text-[10px] font-mono">
                      <div className="text-red-400 font-bold">(+) Red → Relay COM</div>
                      <div className="text-neutral-400 font-bold">(-) Black → Pump (-)</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border transition-all ${
                    isDispensing
                      ? 'bg-sky-950/80 border-sky-400 shadow-xl shadow-sky-950/50'
                      : 'bg-neutral-900 border-neutral-700'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Droplets className={`w-5 h-5 ${isDispensing ? 'text-sky-300 animate-bounce' : 'text-neutral-500'}`} />
                        <div>
                          <p className="text-xs font-bold text-neutral-200">Water Dispenser</p>
                          <p className="text-[10px] text-neutral-400">DC Submersible Pump</p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        isDispensing ? 'bg-sky-500 text-black animate-pulse' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {isDispensing ? 'DISPENSING' : 'IDLE'}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono bg-neutral-950 p-2 rounded border border-neutral-800 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-red-400 font-bold">Red Wire (+):</span>
                        <span className="text-neutral-300">to Relay NO</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400 font-bold">Black Wire (-):</span>
                        <span className="text-neutral-300">to 9V Battery (-)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isDispensing && (
                <div className="mt-4 p-2.5 bg-sky-950/50 border border-sky-800/80 rounded-xl flex items-center justify-between text-xs text-sky-200 font-mono animate-pulse">
                  <span className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-sky-400" />
                    <span>RELAY CONTACT CLOSED: 9V flowing into Water Dispenser → Pumping water stream</span>
                  </span>
                  <span className="text-emerald-400 font-bold">Circuit Complete (CLOSED LOOP)</span>
                </div>
              )}
            </div>
          </div>

          {/* Color-Coded Wiring Guide */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center text-xs font-bold font-mono">
                  1
                </span>
                <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
                  Control Side Wiring (Arduino Uno)
                </h3>
              </div>

              <div className="overflow-hidden border border-neutral-800 rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
                    <tr>
                      <th className="py-2 px-3">Device & Pin</th>
                      <th className="py-2 px-3">Wire</th>
                      <th className="py-2 px-3">Connects To Arduino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 bg-neutral-950/40">
                    <tr>
                      <td className="py-2 px-3 text-amber-300 font-semibold">MQ Sensor VCC</td>
                      <td className="py-2 px-3 text-red-400">🔴 Red</td>
                      <td className="py-2 px-3 text-neutral-200 font-bold">5V Pin</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-amber-300 font-semibold">MQ Sensor GND</td>
                      <td className="py-2 px-3 text-neutral-400">⚫ Black</td>
                      <td className="py-2 px-3 text-neutral-200 font-bold">GND Pin</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-amber-300 font-semibold">MQ Sensor AO</td>
                      <td className="py-2 px-3 text-emerald-400">🟢 Green</td>
                      <td className="py-2 px-3 text-emerald-300 font-bold">Analog Pin A0</td>
                    </tr>
                    <tr className="bg-neutral-900/60">
                      <td className="py-2 px-3 text-sky-300 font-semibold">Relay VCC</td>
                      <td className="py-2 px-3 text-red-400">🔴 Red</td>
                      <td className="py-2 px-3 text-neutral-200 font-bold">5V Pin</td>
                    </tr>
                    <tr className="bg-neutral-900/60">
                      <td className="py-2 px-3 text-sky-300 font-semibold">Relay GND</td>
                      <td className="py-2 px-3 text-neutral-400">⚫ Black</td>
                      <td className="py-2 px-3 text-neutral-200 font-bold">GND Pin</td>
                    </tr>
                    <tr className="bg-neutral-900/60">
                      <td className="py-2 px-3 text-sky-300 font-semibold">Relay IN</td>
                      <td className="py-2 px-3 text-amber-300">🟡 Yellow</td>
                      <td className="py-2 px-3 text-amber-300 font-bold">Digital Pin 7</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center text-xs font-bold font-mono">
                  2
                </span>
                <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider">
                  Load Side Wiring (9V Battery & Water Dispenser)
                </h3>
              </div>

              <div className="overflow-hidden border border-neutral-800 rounded-xl">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
                    <tr>
                      <th className="py-2 px-3">From Component</th>
                      <th className="py-2 px-3">Wire</th>
                      <th className="py-2 px-3">Connects To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 bg-neutral-950/40">
                    <tr>
                      <td className="py-2 px-3 text-amber-300 font-semibold">9V Battery (+) Red</td>
                      <td className="py-2 px-3 text-red-400">🔴 Red Lead</td>
                      <td className="py-2 px-3 text-sky-300 font-bold">Relay COM (Middle screw)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-sky-300 font-semibold">Relay NO (Normally Open)</td>
                      <td className="py-2 px-3 text-red-400">🔴 Jumper</td>
                      <td className="py-2 px-3 text-red-400 font-bold">Water Dispenser Red (+)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-neutral-200 font-semibold">Water Dispenser Black (-)</td>
                      <td className="py-2 px-3 text-neutral-400">⚫ Black</td>
                      <td className="py-2 px-3 text-neutral-200 font-bold">9V Battery (-) Black Lead</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-red-950/40 rounded-xl border border-red-900/60 text-xs text-red-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>CRITICAL ELECTRICAL ISOLATION RULE:</span>
                </div>
                <p className="text-[11px] text-red-300/90 leading-relaxed">
                  NEVER power the DC water dispenser directly from the Arduino 5V pin. The pump motor draws 600-800mA, exceeding the Arduino onboard regulator's 200mA limit. The isolated 9V battery circuit ensures safe, reliable operation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ESP32-CAM WI-FI CAMERA IOT CIRCUIT */}
      {selectedIoTTab === 'esp32_cam' && (
        <div className="space-y-6">
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-mono border border-sky-800/60 font-semibold">
                  Wireless IP Video Surveillance Node
                </span>
                <h3 className="text-base font-bold text-neutral-100 font-display mt-1">
                  ESP32-CAM AI-Thinker Wiring & Flashing Schematic
                </h3>
                <p className="text-xs text-neutral-400">
                  Connects to FTDI USB-to-TTL programmer to flash firmware, then streams live MJPEG video over your home Wi-Fi network.
                </p>
              </div>
            </div>

            {/* Visual Schematic for ESP32-CAM */}
            <div className="bg-neutral-950 rounded-xl p-6 border border-neutral-800 overflow-x-auto min-w-[700px]">
              <div className="grid grid-cols-12 gap-5 items-center">
                {/* FTDI Programmer (Cols 1-4) */}
                <div className="col-span-4 p-4 bg-neutral-900 rounded-xl border border-neutral-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-amber-400" />
                      FTDI USB-to-TTL Programmer
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                      Set jumper to 5V
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">Plugs into PC USB Port</p>

                  <div className="space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between px-2 py-1 bg-neutral-950 rounded border border-neutral-800">
                      <span className="text-red-400 font-bold">VCC (5V)</span>
                      <span className="text-neutral-400">→ ESP32-CAM 5V</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 bg-neutral-950 rounded border border-neutral-800">
                      <span className="text-neutral-400 font-bold">GND</span>
                      <span className="text-neutral-400">→ ESP32-CAM GND</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 bg-neutral-950 rounded border border-neutral-800">
                      <span className="text-sky-400 font-bold">TX (Transmit)</span>
                      <span className="text-sky-300">→ U0R (RX)</span>
                    </div>
                    <div className="flex justify-between px-2 py-1 bg-neutral-950 rounded border border-neutral-800">
                      <span className="text-emerald-400 font-bold">RX (Receive)</span>
                      <span className="text-emerald-300">→ U0T (TX)</span>
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="col-span-1 text-center text-sky-400 font-mono font-bold text-xs">
                  <span>──►</span>
                  <p className="text-[9px] text-neutral-500">Serial</p>
                </div>

                {/* ESP32-CAM Board (Cols 6-12) */}
                <div className="col-span-7 p-4 bg-sky-950/40 rounded-xl border border-sky-800/80 shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-sky-400 animate-pulse" />
                      <span className="text-xs font-bold text-sky-200">ESP32-CAM Board (AI-Thinker)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-900 text-sky-300 font-mono">
                      OV2640 Lens Included
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                    <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 space-y-1">
                      <p className="text-neutral-400 font-bold uppercase text-[9px]">Power & Flashing</p>
                      <p className="text-red-400">● 5V Pin (Needs 5V &gt; 1A)</p>
                      <p className="text-neutral-400">● GND Pin</p>
                      <p className="text-amber-400 font-bold">● GPIO 0 (Flash Mode)</p>
                    </div>

                    <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 space-y-1">
                      <p className="text-neutral-400 font-bold uppercase text-[9px]">Serial Pins</p>
                      <p className="text-sky-300">● U0R (UART0 RX)</p>
                      <p className="text-emerald-300">● U0T (UART0 TX)</p>
                      <p className="text-neutral-500">● GPIO 4 (Flashlight LED)</p>
                    </div>
                  </div>

                  {/* Crucial Flashing Jumper Callout */}
                  <div className="p-2.5 bg-amber-950/70 border border-amber-600/80 rounded-lg text-amber-200 text-xs">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>THE FLASH MODE JUMPER (CRITICAL):</span>
                    </p>
                    <p className="text-[11px] mt-1 text-amber-200/90 leading-relaxed">
                      1. Connect a jumper wire between <strong>GPIO 0</strong> and <strong>GND</strong> when uploading the sketch in Arduino IDE.
                      <br />
                      2. Press the <strong>RST (Reset)</strong> button on the bottom of the ESP32-CAM board right as the upload starts.
                      <br />
                      3. After upload completes, <strong>REMOVE the GPIO 0 to GND wire</strong> and press <strong>RST</strong> once to start streaming!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Integration with FireGuard AI Homescreen */}
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 text-xs space-y-2">
              <h4 className="font-bold text-neutral-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>How to Add Your ESP32-CAM to FireGuard AI Homescreen:</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-neutral-400 text-[11px] leading-relaxed">
                <li>Open Arduino IDE Serial Monitor at <strong>115200 baud</strong> to find your camera IP (e.g. <code className="text-sky-300">http://192.168.1.50</code>).</li>
                <li>In FireGuard AI, click <strong>"+ Add Wi-Fi Camera"</strong> on the homescreen.</li>
                <li>Select the <strong>"ESP32-CAM Wi-Fi Module"</strong> preset, paste the IP address, and click <strong>"Add Camera to Homescreen"</strong>.</li>
                <li>Your live camera stream will immediately appear with continuous YOLOv8 fire and human recognition!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ESP8266 / ESP32 WIRELESS SENSOR NODE */}
      {selectedIoTTab === 'esp8266_node' && (
        <div className="space-y-6">
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono border border-amber-800/60 font-semibold">
                Autonomous Wireless Microcontroller Node
              </span>
              <h3 className="text-base font-bold text-neutral-100 font-display mt-1">
                ESP8266 NodeMCU / ESP32 Standalone Wi-Fi Relay Schematic
              </h3>
              <p className="text-xs text-neutral-400">
                Operates completely over Wi-Fi without needing a direct USB cable to your PC. Sends telemetry and triggers sprinklers wirelessly.
              </p>
            </div>

            <div className="overflow-hidden border border-neutral-800 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">Device & Component</th>
                    <th className="py-2.5 px-3">Pin on Sensor / Relay</th>
                    <th className="py-2.5 px-3">Connects To NodeMCU / ESP32</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 bg-neutral-950/40">
                  <tr>
                    <td className="py-2 px-3 font-semibold text-amber-300">MQ-2 Smoke Sensor</td>
                    <td className="py-2 px-3 text-red-400">VCC</td>
                    <td className="py-2 px-3 text-neutral-200 font-bold">VIN (5V) Pin</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-amber-300">MQ-2 Smoke Sensor</td>
                    <td className="py-2 px-3 text-neutral-400">GND</td>
                    <td className="py-2 px-3 text-neutral-200 font-bold">GND Pin</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-amber-300">MQ-2 Smoke Sensor</td>
                    <td className="py-2 px-3 text-emerald-400">AO (Analog Out)</td>
                    <td className="py-2 px-3 text-emerald-300 font-bold">Pin A0 (ADC0)</td>
                  </tr>
                  <tr className="bg-neutral-900/60">
                    <td className="py-2 px-3 font-semibold text-sky-300">5V Relay Module</td>
                    <td className="py-2 px-3 text-red-400">VCC</td>
                    <td className="py-2 px-3 text-neutral-200 font-bold">VIN (5V) Pin</td>
                  </tr>
                  <tr className="bg-neutral-900/60">
                    <td className="py-2 px-3 font-semibold text-sky-300">5V Relay Module</td>
                    <td className="py-2 px-3 text-neutral-400">GND</td>
                    <td className="py-2 px-3 text-neutral-200 font-bold">GND Pin</td>
                  </tr>
                  <tr className="bg-neutral-900/60">
                    <td className="py-2 px-3 font-semibold text-sky-300">5V Relay Module</td>
                    <td className="py-2 px-3 text-amber-300">IN (Signal)</td>
                    <td className="py-2 px-3 text-amber-300 font-bold">Pin D1 (GPIO 5)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-neutral-300">Active Piezo Buzzer</td>
                    <td className="py-2 px-3 text-red-400">(+) Positive</td>
                    <td className="py-2 px-3 text-neutral-200 font-bold">Pin D2 (GPIO 4)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-neutral-300">Active Piezo Buzzer</td>
                    <td className="py-2 px-3 text-neutral-400">(-) Negative</td>
                    <td className="py-2 px-3 text-neutral-200 font-bold">GND Pin</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FULL ARCHITECTURE MAP */}
      {selectedIoTTab === 'full_architecture' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-sky-950/40 border border-sky-800/40 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/60 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider flex items-center gap-2">
                  <span>Complete Integrated FireGuard AI System Architecture</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  How computer vision AI, cloud notification services, and physical microcontrollers collaborate in real time:
                </p>
              </div>
            </div>

            {/* Pipeline Step Boxes */}
            <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 grid grid-cols-1 md:grid-cols-4 gap-3 items-center text-xs font-mono">
              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 text-center space-y-1">
                <Video className="w-5 h-5 text-sky-400 mx-auto" />
                <p className="font-bold text-neutral-200">1. IoT Camera</p>
                <p className="text-[10px] text-neutral-400">USB Webcam / Phone / ESP32-CAM</p>
                <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/40">
                  30 FPS RTSP/MJPEG
                </span>
              </div>

              <div className="hidden md:flex justify-center text-neutral-600">
                <div className="text-center">
                  <span className="text-[10px] text-sky-400 font-bold">Frames</span>
                  <p className="text-neutral-500">────────►</p>
                </div>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 text-center space-y-1">
                <Laptop className="w-5 h-5 text-amber-400 mx-auto" />
                <p className="font-bold text-neutral-200">2. YOLOv8 AI Core</p>
                <p className="text-[10px] text-neutral-400">Runs Neural Net Detection</p>
                <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/40">
                  Identifies Fire & People
                </span>
              </div>

              <div className="hidden md:flex justify-center text-neutral-600">
                <div className="text-center">
                  <span className="text-[10px] text-emerald-400 font-bold">Serial / HTTP</span>
                  <p className="text-neutral-500">────────►</p>
                </div>
              </div>

              <div className="md:col-span-4 p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-neutral-300">
                    <strong>3. Microcontroller Actuation (Arduino / ESP32):</strong> Upon fire detection, trips <strong>Pin 7 / Relay</strong> to activate the <strong>Water Dispenser Sprinkler</strong> and dispatches <strong>Telegram bot alerts</strong>.
                  </span>
                </div>
                <span className="text-emerald-400 font-bold text-[11px] shrink-0 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-800/50">
                  Sub-Second Response
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* C++ Arduino / ESP Sketch Code Card with Copy & Download */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800/60 font-semibold">
                Tested Firmware Code (.ino)
              </span>
              <span className="text-xs font-semibold text-neutral-300">
                {selectedIoTTab === 'esp32_cam' ? 'ESP32-CAM Video Stream' : selectedIoTTab === 'esp8266_node' ? 'NodeMCU / ESP32 Wireless' : 'Arduino Uno 5-Component'}
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-100 font-display mt-0.5">
              Ready-to-Flash Arduino / ESP Code: <code className="text-emerald-300 font-mono">{currentSketchName}</code>
            </h3>
            <p className="text-xs text-neutral-400">
              Paste directly into Arduino IDE. Configured with exact pinout mappings.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadIno}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span>Download .ino</span>
            </button>
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-900/40"
            >
              {copiedCode ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Sketch'}</span>
            </button>
          </div>
        </div>

        {/* Code display window */}
        <div className="relative bg-neutral-950 rounded-xl border border-neutral-800 p-4 font-mono text-xs overflow-x-auto max-h-[360px] text-neutral-300 leading-relaxed">
          <pre>{currentSketch}</pre>
        </div>
      </div>

      {/* Troubleshooting FAQs */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-400" />
          <span>IoT Hardware Troubleshooting & Quick Tips</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1">
            <p className="font-semibold text-amber-300">1. Dispenser turns ON immediately when powered?</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Your relay module is Active-HIGH instead of Active-LOW. In the sketch, change <code className="text-emerald-400 font-mono">const int RELAY_ON = HIGH;</code> and <code className="text-emerald-400 font-mono">const int RELAY_OFF = LOW;</code>.
            </p>
          </div>

          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1">
            <p className="font-semibold text-amber-300">2. ESP32-CAM upload failed with "A fatal error occurred"?</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Ensure <strong>GPIO 0 is connected to GND</strong> during upload, and press the board's <strong>RST</strong> button right as Arduino IDE says <em>"Connecting........"</em>.
            </p>
          </div>

          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1">
            <p className="font-semibold text-amber-300">3. MQ Sensor warm to the touch?</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              This is <strong>100% normal</strong>! MQ sensors have an internal heating coil that warms the tin dioxide (SnO2) sensing element to detect smoke particles accurately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
