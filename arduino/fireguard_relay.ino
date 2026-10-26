/*
 * ==============================================================================
 *  FireGuard AI - Autonomous Fire Suppression & IoT Controller Sketch (.ino)
 *  Compatible with: Arduino Uno (R3 & R4), Nano, Mega 2560, Leonardo, ESP32, etc.
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

void processSerialPacket(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "FIRE_ON" || cmd == "FIRE_ALERT") {
    setFireAlarmState(true, "AI_VISION_FIRE");
  } 
  else if (cmd == "SMOKE_ON" || cmd == "SMOKE_ALERT") {
    setFireAlarmState(true, "AI_VISION_SMOKE");
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

  digitalWrite(PIN_RELAY_PUMP, RELAY_OFF);
  digitalWrite(PIN_RELAY_FAN, RELAY_OFF);
  digitalWrite(PIN_LED_STATUS, LOW);
  activateBuzzer(false, false);

  activateBuzzer(true, true);
  delay(100);
  activateBuzzer(false, false);

  Serial.println(F("FIREGUARD_ARDUINO_ONLINE"));
}

void loop() {
  unsigned long now = millis();

  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    if (ch == '\n' || ch == '\r') {
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

  int smokeLevel = analogRead(PIN_SMOKE_ANALOG);

  if (smokeLevel > SMOKE_THRESHOLD && !isFireActive) {
    setFireAlarmState(true, "PHYSICAL_SMOKE_SENSOR");
  }

  if (isFireActive || isBuzzerOverride) {
    if (now - lastSirenToggle >= SIREN_CYCLE_MS) {
      lastSirenToggle = now;
      sirenPitchHigh = !sirenPitchHigh;
      activateBuzzer(true, sirenPitchHigh);
      digitalWrite(PIN_LED_STATUS, sirenPitchHigh ? HIGH : LOW);
    }
  }

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
