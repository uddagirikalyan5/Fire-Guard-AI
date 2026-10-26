import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, DetectionEvent, AppSettings, User, BoundingBox, SerialLog, ArduinoConnectionStatus } from './types';
import { DEFAULT_CAMERAS, DEFAULT_SETTINGS, INITIAL_DETECTION_EVENTS } from './data/initialData';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { HistoryView } from './components/HistoryView';
import { RelayView } from './components/RelayView';
import { SettingsView } from './components/SettingsView';
import { CameraManagerModal } from './components/CameraManagerModal';
import { AddWifiCameraModal } from './components/AddWifiCameraModal';
import { PythonProjectView } from './components/PythonProjectView';
import { PhaseTrackerModal } from './components/PhaseTrackerModal';
import { EmergencyAlertModal } from './components/EmergencyAlertModal';
import { CircuitDiagramView } from './components/CircuitDiagramView';
import { CameraTroubleshooterModal } from './components/CameraTroubleshooterModal';
import { soundAlarm } from './utils/audioAlarm';
import { sendTelegramFireAlert } from './utils/telegram';
import { arduinoSerial } from './utils/arduinoSerial';

export default function App() {
  const [showTroubleshooterModal, setShowTroubleshooterModal] = useState<boolean>(false);
  // Authentication State (defaults cleared)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('fireguard_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.id === 'usr-admin' || parsed?.id === 'usr-user' || parsed?.id === 'usr-safety') {
          localStorage.removeItem('fireguard_user');
          return null;
        }
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Cameras State (only real cameras, no sample feeds)
  const [cameras, setCameras] = useState<Camera[]>(() => {
    try {
      const saved = localStorage.getItem('fireguard_cameras');
      const list: Camera[] = saved ? JSON.parse(saved) : DEFAULT_CAMERAS;
      const seen = new Set<string>();
      const realOnly = list
        .filter((cam: any) => cam.type !== 'sample_feed')
        .filter((cam) => {
          const key = `${(cam.name || '').trim().toLowerCase()}__${(cam.url || '').trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return realOnly.length > 0 ? realOnly : DEFAULT_CAMERAS;
    } catch {
      return DEFAULT_CAMERAS;
    }
  });
  const [activeCamera, setActiveCamera] = useState<Camera>(cameras[0] || DEFAULT_CAMERAS[0]);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('fireguard_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Detection History State (clean real logs only, no sample events)
  const [events, setEvents] = useState<DetectionEvent[]>(() => {
    try {
      const saved = localStorage.getItem('fireguard_events');
      const list: DetectionEvent[] = saved ? JSON.parse(saved) : INITIAL_DETECTION_EVENTS;
      const seen = new Set<string>();
      const realEvents = list
        .filter(e => !e.id.startsWith('evt-10')) // Purge pre-seeded sample events
        .filter((e) => {
          const key = `${e.id}__${e.room}__${e.timestamp}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return realEvents;
    } catch {
      return [];
    }
  });

  // Real-time Hazard & Telemetry State
  const [isMonitoring, setIsMonitoring] = useState<boolean>(true);
  const [hasFire, setHasFire] = useState<boolean>(false);
  const [hazardType, setHazardType] = useState<'Fire' | 'Smoke' | 'Fire & Smoke'>('Fire');
  const [alertRoom, setAlertRoom] = useState<string>(cameras[0]?.room || 'Main Safety Zone');
  const [currentConfidence, setCurrentConfidence] = useState<number>(0);
  const [currentBboxes, setCurrentBboxes] = useState<BoundingBox[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);

  // Hardware Relay & Web Serial State
  const [arduinoRelayActive, setArduinoRelayActive] = useState<boolean>(false);
  const [arduinoStatus, setArduinoStatus] = useState<ArduinoConnectionStatus>('disconnected');
  const [arduinoPortInfo, setArduinoPortInfo] = useState<string>('');
  const [arduinoLastError, setArduinoLastError] = useState<string>('');
  const [serialLogs, setSerialLogs] = useState<SerialLog[]>([]);

  // Telegram Status (starts at 0 alerts)
  const [telegramStatus, setTelegramStatus] = useState<{ lastSent?: string; count: number }>({ count: 0 });

  // Modals
  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [showAddWifiModal, setShowAddWifiModal] = useState<boolean>(false);
  const [showPythonStudio, setShowPythonStudio] = useState<boolean>(false);
  const [showPhaseTracker, setShowPhaseTracker] = useState<boolean>(false);

  // Alert cooldown ref to avoid spamming
  const lastAlertTimestampRef = useRef<number>(0);

  // Auto-deduplicate cameras and events and scrub legacy demo data from localStorage on mount
  useEffect(() => {
    try {
      // 1. Scrub duplicate cameras
      const savedCams = localStorage.getItem('fireguard_cameras');
      if (savedCams) {
        const parsed = JSON.parse(savedCams);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const deduped = parsed.filter(c => {
            const key = `${(c.name || '').trim().toLowerCase()}__${(c.url || '').trim().toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (deduped.length !== parsed.length) {
            setCameras(deduped);
            localStorage.setItem('fireguard_cameras', JSON.stringify(deduped));
          }
        }
      }

      // 2. Scrub duplicate events
      const savedEvts = localStorage.getItem('fireguard_events');
      if (savedEvts) {
        const parsed = JSON.parse(savedEvts);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          const deduped = parsed.filter(e => {
            const key = `${e.room}__${e.timestamp}__${e.confidence}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (deduped.length !== parsed.length) {
            setEvents(deduped);
            localStorage.setItem('fireguard_events', JSON.stringify(deduped));
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('fireguard_cameras', JSON.stringify(cameras));
  }, [cameras]);

  useEffect(() => {
    localStorage.setItem('fireguard_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('fireguard_events', JSON.stringify(events));
  }, [events]);

  const addSerialLog = useCallback((type: 'TX' | 'RX' | 'INFO' | 'ERR', message: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour12: false });
    setSerialLogs(prev => [
      { id: `log-${Date.now()}-${Math.random()}`, timestamp: timeStr, type, message },
      ...prev.slice(0, 100)
    ]);
  }, []);

  // Web Serial Event Listeners & Auto-connect on Mount
  useEffect(() => {
    const unsubLog = arduinoSerial.onLog((type, msg) => {
      addSerialLog(type, msg);
    });

    const unsubStatus = arduinoSerial.onStatusChange((status, error, portInfo) => {
      setArduinoStatus(status);
      if (error) setArduinoLastError(error);
      if (portInfo) setArduinoPortInfo(portInfo);
    });

    const unsubData = arduinoSerial.onData((line) => {
      if (line.includes('PUMP=ON') || line.includes('ALERT:FIRE_ACTIVATED') || line.includes('ACK:PUMP_ON')) {
        setArduinoRelayActive(true);
      } else if (line.includes('PUMP=OFF') || line.includes('ACK:FIRE_DEACTIVATED') || line.includes('ACK:PUMP_OFF')) {
        setArduinoRelayActive(false);
      }
    });

    // Check browser support and attempt auto-connect if user already approved a COM port
    const support = arduinoSerial.checkBrowserSupport();
    if (!support.supported) {
      setArduinoStatus('unsupported');
      setArduinoLastError(support.reason || 'Web Serial API unsupported');
    } else {
      arduinoSerial.tryAutoConnect(settings.arduinoBaudRate);
    }

    return () => {
      unsubLog();
      unsubStatus();
      unsubData();
    };
  }, [addSerialLog, settings.arduinoBaudRate]);

  // Connect to Arduino Uno over Web Serial API
  const handleConnectArduino = useCallback(async () => {
    return await arduinoSerial.requestAndConnect(settings.arduinoBaudRate);
  }, [settings.arduinoBaudRate]);

  // Disconnect Arduino safely
  const handleDisconnectArduino = useCallback(async () => {
    await arduinoSerial.disconnect();
  }, []);

  // UNIFIED HARDWARE CONTROL: Activates Relay Pin 7 -> Water Pump ON
  const triggerHardwareFireOn = useCallback(async (sourceDescription: string = 'Simulate Fire') => {
    addSerialLog('INFO', `▶ [HARDWARE TRIGGER] Hazard Activated from: ${sourceDescription}`);
    setHasFire(true);
    setArduinoRelayActive(true);

    // Play sound alarm if enabled
    if (settings.alarmSoundEnabled) {
      soundAlarm.playAlarm(settings.alarmVolume);
    }

    // Check connection state
    const isConn = arduinoSerial.isConnected();
    addSerialLog(
      'INFO',
      `[HARDWARE LINK] Status: ${arduinoSerial.getStatus().toUpperCase()} (${isConn ? arduinoSerial.getPortName() : 'Not Connected'})`
    );

    // Transmit actual hardware command to Arduino Uno
    const result = await arduinoSerial.sendCommand('FIRE_ON');
    if (result.success) {
      addSerialLog(
        'INFO',
        `✔ [HARDWARE TX SUCCESS] 'FIRE_ON' sent -> Arduino Relay Pin 7 ENERGIZED (12V Water Pump ON)`
      );
    } else {
      addSerialLog(
        'ERR',
        `✖ [HARDWARE TX ERROR] ${result.error || 'Failed to send FIRE_ON'}. To activate the real physical water pump, click 'Connect Arduino (USB)' to pair your COM port.`
      );
    }
    return result;
  }, [settings.alarmSoundEnabled, settings.alarmVolume, addSerialLog]);

  // UNIFIED HARDWARE CONTROL: Deactivates Relay Pin 7 -> Water Pump OFF
  const triggerHardwareFireOff = useCallback(async (sourceDescription: string = 'Reset / Silence') => {
    addSerialLog('INFO', `▶ [HARDWARE RESET] Hazard Deactivated from: ${sourceDescription}`);
    soundAlarm.stopAlarm();
    setHasFire(false);
    setArduinoRelayActive(false);
    setShowEmergencyModal(false);

    // Transmit actual hardware command to Arduino Uno
    const result = await arduinoSerial.sendCommand('FIRE_OFF');
    if (result.success) {
      addSerialLog(
        'INFO',
        `✔ [HARDWARE TX SUCCESS] 'FIRE_OFF' sent -> Arduino Relay Pin 7 DE-ENERGIZED (12V Water Pump OFF)`
      );
    } else {
      addSerialLog(
        'INFO',
        `[HARDWARE STATUS] 'FIRE_OFF' dispatched (${result.error || 'Arduino offline'})`
      );
    }
    return result;
  }, [addSerialLog]);

  // Main Hazard (Fire or Smoke) Trigger Handler (Used by YOLO Camera Vision & Simulate Fire)
  const handleTriggerFireAlert = useCallback((
    customConfidence: number = 94,
    customRoom?: string,
    type: 'Fire' | 'Smoke' | 'Fire & Smoke' = 'Fire',
    origin: string = 'AI Camera Vision'
  ) => {
    const roomName = customRoom || activeCamera.room;
    setAlertRoom(roomName);
    setHazardType(type);
    setCurrentConfidence(customConfidence);

    // Call unified hardware function to trigger Arduino relay & water pump
    triggerHardwareFireOn(`${origin} [${type} - ${customConfidence}%]`);

    const now = Date.now();
    const cooldownMs = settings.alertCooldownSeconds * 1000;

    // Check cooldown before logging and notifying
    if (now - lastAlertTimestampRef.current > cooldownMs) {
      lastAlertTimestampRef.current = now;

      const matchingCam = cameras.find(c => c.room === roomName) || activeCamera;

      // Log event in database
      const newEvent: DetectionEvent = {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) + ' ' +
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        room: roomName,
        cameraName: matchingCam.name,
        confidence: customConfidence,
        status: 'Active',
        source: `${type} Detection (Water Pump Triggered via ${origin})`,
        temperatureEstimate: type === 'Smoke' ? 190 : Math.floor(350 + Math.random() * 200)
      };
      setEvents(prev => [newEvent, ...prev]);

      // Dispatch Telegram notification
      if (settings.telegramEnabled) {
        sendTelegramFireAlert(
          settings.telegramBotToken,
          settings.telegramChatId,
          `${roomName} [${type.toUpperCase()} DETECTED - WATER PUMP ON]`,
          customConfidence,
          undefined,
          user?.mobileNumber,
          user?.email,
          user?.fullName
        ).then(res => {
          setTelegramStatus(prev => ({ lastSent: res.timestamp, count: prev.count + 1 }));
          addSerialLog('INFO', `Telegram Dispatch: ${res.message}`);
        });
      }

      // Show emergency overlay popup
      setShowEmergencyModal(true);
    }
  }, [activeCamera, cameras, settings, addSerialLog, user, triggerHardwareFireOn]);

  // Silence Alarm & Reset Fire State -> Sends FIRE_OFF to turn pump off
  const handleSilenceAlarm = useCallback(() => {
    triggerHardwareFireOff('Operator Silence Alarm / Reset');
  }, [triggerHardwareFireOff]);

  // Manual Toggle of Arduino Relay
  const handleToggleArduinoRelay = useCallback((active: boolean) => {
    if (active) {
      triggerHardwareFireOn('Manual Relay Switch');
    } else {
      triggerHardwareFireOff('Manual Relay Switch');
    }
  }, [triggerHardwareFireOn, triggerHardwareFireOff]);

  // Direct Serial Command Sender (from Terminal or diagnostics)
  const handleSendSerialCommand = useCallback(async (cmd: string) => {
    const cleanCmd = cmd.trim().toUpperCase();
    if (cleanCmd === 'FIRE_ON' || cleanCmd === 'PUMP_ON') {
      await triggerHardwareFireOn(`Custom Command: ${cleanCmd}`);
    } else if (cleanCmd === 'FIRE_OFF' || cleanCmd === 'PUMP_OFF' || cleanCmd === 'RESET') {
      await triggerHardwareFireOff(`Custom Command: ${cleanCmd}`);
    } else {
      await arduinoSerial.sendCommand(cleanCmd);
    }
  }, [triggerHardwareFireOn, triggerHardwareFireOff]);

  const handleAddCamera = (newCam: Omit<Camera, 'id'>, autoSelect: boolean = true) => {
    // Avoid duplicate cameras by checking existing name and URL
    const existingIndex = cameras.findIndex(
      c => c.name.trim().toLowerCase() === newCam.name.trim().toLowerCase() ||
           (c.url.trim().toLowerCase() === newCam.url.trim().toLowerCase() && newCam.url.trim() !== '0')
    );

    let activeCam: Camera;
    if (existingIndex !== -1) {
      const updated = [...cameras];
      updated[existingIndex] = { ...updated[existingIndex], ...newCam };
      setCameras(updated);
      activeCam = updated[existingIndex];
      localStorage.setItem('fireguard_cameras', JSON.stringify(updated));
    } else {
      const id = `cam-${Date.now()}`;
      const cam: Camera = { ...newCam, id };
      const updated = [...cameras, cam];
      setCameras(updated);
      activeCam = cam;
      localStorage.setItem('fireguard_cameras', JSON.stringify(updated));
    }

    if (autoSelect) {
      setActiveCamera(activeCam);
      setActiveTab('dashboard');
      setIsMonitoring(true);
    }
  };

  const handleDeleteDuplicateCameras = () => {
    const seen = new Set<string>();
    const unique = cameras.filter(cam => {
      const key = `${(cam.name || '').trim().toLowerCase()}__${(cam.url || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setCameras(unique);
    if (!unique.find(c => c.id === activeCamera.id)) {
      setActiveCamera(unique[0] || DEFAULT_CAMERAS[0]);
    }
    localStorage.setItem('fireguard_cameras', JSON.stringify(unique));
  };

  const handleDeleteDuplicateEvents = () => {
    const seen = new Set<string>();
    const unique = events.filter(e => {
      const key = `${e.room}__${e.timestamp}__${e.confidence}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setEvents(unique);
    localStorage.setItem('fireguard_events', JSON.stringify(unique));
  };

  const handleDeleteCamera = (id: string) => {
    if (cameras.length <= 1) return;
    setCameras(prev => {
      const next = prev.filter(c => c.id !== id);
      if (activeCamera.id === id) {
        setActiveCamera(next[0]);
      }
      return next;
    });
  };

  const handleUpdateEventStatus = (id: string, status: 'Active' | 'Acknowledged' | 'Resolved') => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    if (status === 'Resolved') {
      soundAlarm.stopAlarm();
      setHasFire(false);
    }
  };

  const handleClearHistory = () => {
    setEvents([]);
  };

  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    localStorage.setItem('fireguard_user', JSON.stringify(authenticatedUser));
    soundAlarm.playBeep(660, 0.1);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('fireguard_user');
    soundAlarm.stopAlarm();
  };

  // If operator not authenticated, show modern dark login screen
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased selection:bg-red-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCamera={activeCamera}
        isMonitoring={isMonitoring}
        hasFire={hasFire}
        currentConfidence={currentConfidence}
        settings={settings}
        setSettings={setSettings}
        onOpenPythonStudio={() => setShowPythonStudio(true)}
        onOpenPhaseTracker={() => setShowPhaseTracker(true)}
        onOpenTroubleshooter={() => setShowTroubleshooterModal(true)}
        onLogout={handleLogout}
        arduinoConnected={arduinoStatus === 'connected' || arduinoStatus === 'command_sent'}
        arduinoStatus={arduinoStatus}
        onConnectArduino={handleConnectArduino}
      />

      {/* Main Content Body */}
      <main className="flex-1 pb-10">
        {activeTab === 'dashboard' && (
          <DashboardView
            activeCamera={activeCamera}
            cameras={cameras}
            onSelectCamera={setActiveCamera}
            onOpenAddCamera={() => setShowCameraModal(true)}
            onOpenAddWifiCamera={() => setShowAddWifiModal(true)}
            onDeleteDuplicateCameras={cameras.length > 1 ? handleDeleteDuplicateCameras : undefined}
            onNavigateToTab={setActiveTab}
            isMonitoring={isMonitoring}
            setIsMonitoring={setIsMonitoring}
            hasFire={hasFire}
            currentConfidence={currentConfidence}
            currentBboxes={currentBboxes}
            settings={settings}
            onTriggerFireAlert={handleTriggerFireAlert}
            onSilenceAlarm={handleSilenceAlarm}
            recentEvents={events}
            arduinoRelayActive={arduinoRelayActive}
            onToggleArduinoRelay={handleToggleArduinoRelay}
            telegramStatus={telegramStatus}
            hazardType={hazardType}
            arduinoStatus={arduinoStatus}
            arduinoPortInfo={arduinoPortInfo}
            arduinoLastError={arduinoLastError}
            onConnectArduino={handleConnectArduino}
            onDisconnectArduino={handleDisconnectArduino}
            onSendSerialCommand={handleSendSerialCommand}
            serialLogs={serialLogs}
          />
        )}

        {activeTab === 'circuit' && (
          <div className="max-w-7xl mx-auto px-4 py-4">
            <CircuitDiagramView
              onTestPump={handleToggleArduinoRelay}
              externalPumpActive={arduinoRelayActive}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryView
            events={events}
            onUpdateStatus={handleUpdateEventStatus}
            onClearHistory={handleClearHistory}
            onDeleteDuplicateEvents={handleDeleteDuplicateEvents}
          />
        )}

        {activeTab === 'relay' && (
          <RelayView
            settings={settings}
            arduinoRelayActive={arduinoRelayActive}
            onToggleRelay={handleToggleArduinoRelay}
            serialLogs={serialLogs}
            onClearLogs={() => setSerialLogs([])}
            onSendCustomCommand={handleSendSerialCommand}
            arduinoStatus={arduinoStatus}
            arduinoPortInfo={arduinoPortInfo}
            arduinoLastError={arduinoLastError}
            onConnectArduino={handleConnectArduino}
            onDisconnectArduino={handleDisconnectArduino}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={setSettings}
            onResetDefaults={() => setSettings(DEFAULT_SETTINGS)}
          />
        )}
      </main>

      {/* Camera Management Modal */}
      <CameraManagerModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        cameras={cameras}
        activeCamera={activeCamera}
        onSelectCamera={setActiveCamera}
        onAddCamera={handleAddCamera}
        onDeleteCamera={handleDeleteCamera}
        onDeleteDuplicates={handleDeleteDuplicateCameras}
        onOpenTroubleshooter={() => setShowTroubleshooterModal(true)}
      />

      {/* Add Wi-Fi Camera Modal */}
      <AddWifiCameraModal
        isOpen={showAddWifiModal}
        onClose={() => setShowAddWifiModal(false)}
        onAddCamera={handleAddCamera}
      />

      {/* Python Code Studio & ZIP Export Modal */}
      <PythonProjectView
        isOpen={showPythonStudio}
        onClose={() => setShowPythonStudio(false)}
      />

      {/* Phase Milestone Tracker Modal */}
      <PhaseTrackerModal
        isOpen={showPhaseTracker}
        onClose={() => setShowPhaseTracker(false)}
        onJumpToTab={setActiveTab}
      />

      {/* Emergency Alert Modal */}
      <EmergencyAlertModal
        isOpen={showEmergencyModal}
        room={alertRoom}
        confidence={currentConfidence}
        hazardType={hazardType}
        onSilence={handleSilenceAlarm}
        onAcknowledge={() => setShowEmergencyModal(false)}
        onTriggerRelay={() => handleToggleArduinoRelay(true)}
        relayActive={arduinoRelayActive}
        operatorMobile={user?.mobileNumber}
        operatorEmail={user?.email}
        operatorName={user?.fullName}
      />

      {/* Global Camera Troubleshooter & Diagnostic Modal */}
      <CameraTroubleshooterModal
        isOpen={showTroubleshooterModal}
        onClose={() => setShowTroubleshooterModal(false)}
      />
    </div>
  );
}
