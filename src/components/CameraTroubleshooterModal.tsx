import React, { useState, useEffect, useRef } from 'react';
import {
  X, Camera, AlertTriangle, CheckCircle2, RefreshCw, Smartphone,
  Wifi, HelpCircle, Shield, ExternalLink, Terminal, Monitor,
  Sliders, Video, Volume2, ShieldAlert, Cpu
} from 'lucide-react';
import { soundAlarm } from '../utils/audioAlarm';

interface CameraTroubleshooterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDeviceId?: (deviceId: string) => void;
  currentDeviceId?: string;
  onRefreshFeed?: () => void;
}

interface VideoDevice {
  deviceId: string;
  label: string;
}

export const CameraTroubleshooterModal: React.FC<CameraTroubleshooterModalProps> = ({
  isOpen,
  onClose,
  onSelectDeviceId,
  currentDeviceId,
  onRefreshFeed
}) => {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'python' | 'wifi' | 'mobile'>('diagnostics');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [availableDevices, setAvailableDevices] = useState<VideoDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(currentDeviceId || '');
  const [testStreamActive, setTestStreamActive] = useState<boolean>(false);
  const [testingInProgress, setTestingInProgress] = useState<boolean>(false);
  const [diagnosticLog, setDiagnosticLog] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolutionMode, setResolutionMode] = useState<'auto' | '720p' | '480p' | 'basic'>('auto');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const testVideoRef = useRef<HTMLVideoElement | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  // Stop test stream on unmount or modal close
  useEffect(() => {
    if (!isOpen) {
      stopTestStream();
    } else {
      checkPermissionAndEnumerate();
    }
  }, [isOpen]);

  const addLog = (msg: string) => {
    setDiagnosticLog(prev => [...prev.slice(-15), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const stopTestStream = () => {
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (testVideoRef.current) {
      testVideoRef.current.srcObject = null;
    }
    setTestStreamActive(false);
  };

  const checkPermissionAndEnumerate = async () => {
    addLog('Querying browser camera permissions & device enumeration...');
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          // @ts-ignore
          const res = await navigator.permissions.query({ name: 'camera' });
          setPermissionState(res.state as 'prompt' | 'granted' | 'denied');
          addLog(`Browser camera permission state: ${res.state.toUpperCase()}`);
          res.onchange = () => {
            setPermissionState(res.state as 'prompt' | 'granted' | 'denied');
            addLog(`Permission changed to: ${res.state.toUpperCase()}`);
          };
        } catch {
          // Some browsers like Firefox don't support camera query in permissions API
          setPermissionState('unknown');
        }
      }

      await refreshDeviceList();
    } catch (err: any) {
      addLog(`Enumeration warning: ${err.message || err}`);
    }
  };

  const refreshDeviceList = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      addLog('navigator.mediaDevices not supported by this browser.');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1} (${d.deviceId ? 'Detected' : 'Label Hidden until Permission Granted'})`
        }));

      setAvailableDevices(videoInputs);
      addLog(`Found ${videoInputs.length} video capture device(s) on your system.`);
      
      if (videoInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(videoInputs[0].deviceId);
      }
    } catch (err: any) {
      addLog(`Error listing devices: ${err.message || err}`);
    }
  };

  // Run comprehensive multi-stage camera test
  const handleTestAndGrantCamera = async () => {
    stopTestStream();
    setTestingInProgress(true);
    setErrorMessage(null);
    addLog('Starting camera test & permission request...');
    soundAlarm.playBeep(600, 0.05);

    let constraintsList: MediaStreamConstraints[] = [];

    // Stage 1: Specific deviceId or facingMode with HD
    if (resolutionMode === '720p') {
      constraintsList.push({
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } else if (resolutionMode === '480p') {
      constraintsList.push({
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
    } else if (resolutionMode === 'basic') {
      constraintsList.push({
        video: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
        audio: false
      });
    } else {
      // Auto: Progressive fallback list
      constraintsList = [
        {
          video: {
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        },
        {
          video: {
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
            facingMode: { ideal: facingMode }
          },
          audio: false
        },
        {
          video: {
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined
          },
          audio: false
        },
        {
          video: true,
          audio: false
        }
      ];
    }

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (let i = 0; i < constraintsList.length; i++) {
      try {
        addLog(`Attempting connection with constraint profile #${i + 1}...`);
        stream = await navigator.mediaDevices.getUserMedia(constraintsList[i]);
        if (stream) {
          addLog(`Profile #${i + 1} succeeded! Active video tracks: ${stream.getVideoTracks().length}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        addLog(`Profile #${i + 1} failed: ${err.name} - ${err.message}`);
      }
    }

    setTestingInProgress(false);

    if (stream) {
      testStreamRef.current = stream;
      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
        testVideoRef.current.play().catch(e => addLog(`Video play: ${e.message}`));
      }
      setTestStreamActive(true);
      setPermissionState('granted');
      setErrorMessage(null);
      soundAlarm.playBeep(900, 0.08);

      // Re-enumerate devices now that label names are revealed
      await refreshDeviceList();

      if (onSelectDeviceId && selectedDevice) {
        onSelectDeviceId(selectedDevice);
      }
      if (onRefreshFeed) {
        onRefreshFeed();
      }
    } else {
      setTestStreamActive(false);
      const errName = lastError?.name || 'Error';
      const errMsg = lastError?.message || 'Failed to access camera';
      
      let humanFix = '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        humanFix = 'Permission was blocked by your browser. Click the lock/settings icon 🔒 in your browser address bar, set Camera to "Allow", and refresh.';
        setPermissionState('denied');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        humanFix = 'Your camera is already in use by another program (e.g. Zoom, MS Teams, Google Meet, Skype, or another browser tab). Please close other camera apps and try again.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        humanFix = 'No camera hardware found on this computer. Please connect a USB webcam or try using your smartphone as the camera.';
      } else if (errName === 'OverconstrainedError') {
        humanFix = 'Camera does not support the requested resolution or facing mode. Try selecting "Basic Compatibility" mode below.';
      } else {
        humanFix = `Browser returned: ${errMsg}. Check device manager and camera privacy shutter.`;
      }

      setErrorMessage(humanFix);
      addLog(`Diagnostics failed: ${humanFix}`);
      soundAlarm.playBeep(300, 0.15);
    }
  };

  const handleApplySelectedDevice = () => {
    if (selectedDevice && onSelectDeviceId) {
      onSelectDeviceId(selectedDevice);
      localStorage.setItem('fireguard_preferred_device_id', selectedDevice);
      addLog(`Applied camera device ID to system: ${selectedDevice}`);
      if (onRefreshFeed) onRefreshFeed();
      soundAlarm.playBeep(800, 0.05);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white shadow-md shadow-red-950/50">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                <span>Camera Fix & Diagnostic Center</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  Doctor
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Troubleshoot web feeds, USB webcams, smartphones, ESP32-CAM, and Python OpenCV
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopTestStream();
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-neutral-800 bg-neutral-950/40 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'diagnostics'
                ? 'border-sky-500 text-sky-400 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Webcam & Browser Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'python'
                ? 'border-sky-500 text-sky-400 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Python Project & OpenCV Fix</span>
          </button>

          <button
            onClick={() => setActiveTab('wifi')}
            className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'wifi'
                ? 'border-sky-500 text-sky-400 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>ESP32-CAM & Wi-Fi Streams</span>
          </button>

          <button
            onClick={() => setActiveTab('mobile')}
            className={`px-3 py-2 rounded-t-lg flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'mobile'
                ? 'border-sky-500 text-sky-400 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Use Phone as Live Camera</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          {/* TAB 1: BROWSER & WEBCAM DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              {/* Permission & Status Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <div className="text-xs text-neutral-400 mb-1">Browser Permission</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      permissionState === 'granted'
                        ? 'bg-emerald-500'
                        : permissionState === 'denied'
                        ? 'bg-red-500'
                        : 'bg-amber-500 animate-pulse'
                    }`} />
                    <span className="font-semibold text-neutral-100 uppercase text-xs">
                      {permissionState === 'granted'
                        ? 'Granted / Allowed'
                        : permissionState === 'denied'
                        ? 'Blocked / Denied'
                        : 'Prompt Required'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <div className="text-xs text-neutral-400 mb-1">Detected Hardware</div>
                  <div className="flex items-center gap-2">
                    <Video className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold text-neutral-100 text-xs">
                      {availableDevices.length} Camera(s) Found
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <div className="text-xs text-neutral-400 mb-1">Live Test Stream</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${testStreamActive ? 'bg-emerald-400 animate-ping' : 'bg-neutral-600'}`} />
                    <span className="font-semibold text-neutral-100 text-xs">
                      {testStreamActive ? 'STREAMING ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Alert Box if any */}
              {errorMessage && (
                <div className="p-3.5 bg-red-950/80 border border-red-700/80 rounded-xl text-xs text-red-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-red-100">Camera Access Issue Detected:</div>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Live Test Window and Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Live Preview Box */}
                <div className="bg-black border border-neutral-800 rounded-xl aspect-video relative flex items-center justify-center overflow-hidden shadow-inner">
                  <video
                    ref={testVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${testStreamActive ? 'block' : 'hidden'}`}
                  />

                  {!testStreamActive && (
                    <div className="text-center p-4 space-y-2">
                      <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-neutral-400">
                        No live test preview active yet. Click &quot;Test Camera Now&quot; below to verify your webcam.
                      </p>
                    </div>
                  )}

                  {testStreamActive && (
                    <div className="absolute top-2 left-2 bg-emerald-950/90 border border-emerald-600 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded shadow">
                      ✓ VIDEO SENSOR WORKING
                    </div>
                  )}
                </div>

                {/* Configuration & Controls */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    {/* Device Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1">
                        Select Video Input Device:
                      </label>
                      <select
                        value={selectedDevice}
                        onChange={(e) => {
                          setSelectedDevice(e.target.value);
                          if (onSelectDeviceId) onSelectDeviceId(e.target.value);
                        }}
                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500 font-mono"
                      >
                        {availableDevices.length === 0 ? (
                          <option value="">Default System Webcam</option>
                        ) : (
                          availableDevices.map((dev, idx) => (
                            <option key={dev.deviceId || idx} value={dev.deviceId}>
                              {dev.label}
                            </option>
                          ))
                        )}
                      </select>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Switch here if you have both an integrated laptop webcam and an external USB camera.
                      </p>
                    </div>

                    {/* Resolution / Compatibility Mode */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-300 mb-1">
                          Resolution Profile:
                        </label>
                        <select
                          value={resolutionMode}
                          onChange={(e: any) => setResolutionMode(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                        >
                          <option value="auto">Auto Adaptive (Best)</option>
                          <option value="720p">HD 720p (1280x720)</option>
                          <option value="480p">Standard (640x480)</option>
                          <option value="basic">Basic Compatibility</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-300 mb-1">
                          Mobile Lens Flip:
                        </label>
                        <select
                          value={facingMode}
                          onChange={(e: any) => setFacingMode(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-700 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-mono"
                        >
                          <option value="user">Front Camera (Selfie)</option>
                          <option value="environment">Rear / Main Camera</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleTestAndGrantCamera}
                      disabled={testingInProgress}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-sky-950/50 disabled:opacity-50 transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingInProgress ? 'animate-spin' : ''}`} />
                      <span>{testStreamActive ? 'Retest Connection' : 'Test Camera & Grant Permission'}</span>
                    </button>

                    {testStreamActive && (
                      <button
                        onClick={handleApplySelectedDevice}
                        className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow"
                        title="Set as primary camera feed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Apply Feed</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Diagnostic Log Console */}
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400">
                  <span>Diagnostic Hardware Log:</span>
                  <button
                    onClick={checkPermissionAndEnumerate}
                    className="text-sky-400 hover:underline flex items-center gap-1 text-[10px]"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Rescan Devices
                  </button>
                </div>
                <div className="bg-black/90 p-2.5 rounded-lg font-mono text-[11px] text-neutral-300 max-h-24 overflow-y-auto space-y-0.5 border border-neutral-900">
                  {diagnosticLog.length === 0 ? (
                    <span className="text-neutral-600">Ready to test camera. Click &quot;Test Camera & Grant Permission&quot;.</span>
                  ) : (
                    diagnosticLog.map((log, i) => <div key={i}>{log}</div>)
                  )}
                </div>
              </div>

              {/* 4 Critical Checks to Fix Camera Not Working */}
              <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Top 4 Reasons Why Webcams Fail & How to Fix Them:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg space-y-1">
                    <strong className="text-amber-300 flex items-center gap-1.5">
                      1. Permission Blocked in Browser
                    </strong>
                    <p className="text-neutral-400 text-[11px]">
                      Look at the top URL bar. Click the <strong>lock icon 🔒 or site settings button</strong> on the left of the web address. Ensure <strong>Camera</strong> is set to <strong>Allow</strong>.
                    </p>
                  </div>

                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg space-y-1">
                    <strong className="text-amber-300 flex items-center gap-1.5">
                      2. Camera Locked by Zoom / Teams
                    </strong>
                    <p className="text-neutral-400 text-[11px]">
                      Webcams can only be used by one app at a time. If Zoom, Microsoft Teams, Google Meet, OBS, or another browser tab is open, close them.
                    </p>
                  </div>

                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg space-y-1">
                    <strong className="text-amber-300 flex items-center gap-1.5">
                      3. Physical Privacy Shutter Closed
                    </strong>
                    <p className="text-neutral-400 text-[11px]">
                      Many laptops (Lenovo, HP, Dell, Asus) have a tiny physical sliding shutter over the lens. Check if your camera lens slider is open!
                    </p>
                  </div>

                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg space-y-1">
                    <strong className="text-amber-300 flex items-center gap-1.5">
                      4. Browser iFrame Sandbox
                    </strong>
                    <p className="text-neutral-400 text-[11px]">
                      If the preview is embedded inside an iframe, open the app directly in a full browser tab to grant full hardware permissions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PYTHON PROJECT & OPENCV FIX */}
          {activeTab === 'python' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-neutral-950 to-neutral-900 border border-sky-900/40 rounded-xl flex items-start gap-3">
                <Terminal className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-neutral-100 text-sm">Python OpenCV Camera Guide</h4>
                  <p className="text-neutral-400">
                    If you are running the project via Python (<code className="text-sky-300">python main.py</code>) on your laptop or Raspberry Pi, here is why <code className="text-sky-300">cv2.VideoCapture(0)</code> fails and how to fix it:
                  </p>
                </div>
              </div>

              {/* Step 1: Run the new test_camera.py script */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-neutral-200 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">1</span>
                    Run the Standalone Camera Scanner Script:
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Auto-Detects Working Cameras
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  We included a diagnostic script in your project root called <code className="text-amber-300">test_camera.py</code>. Run it in terminal:
                </p>
                <div className="bg-black/90 p-3 rounded-lg font-mono text-xs text-sky-300 flex items-center justify-between border border-neutral-800">
                  <code>python test_camera.py</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('python test_camera.py');
                      soundAlarm.playBeep(880, 0.05);
                    }}
                    className="text-[11px] text-neutral-400 hover:text-white px-2 py-1 bg-neutral-800 rounded"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  This scans all connected cameras (indices 0, 1, 2, 3), tests DirectShow and MSMF backends, and tells you which camera index is working!
                </p>
              </div>

              {/* Step 2: Index 0 vs Index 1 */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-neutral-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">2</span>
                  Change Camera Index in <code className="text-sky-300 font-mono">config.py</code>:
                </div>
                <p className="text-neutral-400">
                  On laptops with an internal IR sensor or virtual camera, the real USB webcam is often index <strong className="text-neutral-200 font-mono">1</strong> or <strong className="text-neutral-200 font-mono">2</strong> instead of <strong className="text-neutral-200 font-mono">0</strong>.
                </p>
                <div className="bg-black/90 p-3 rounded-lg font-mono text-xs text-amber-300 border border-neutral-800">
                  <div className="text-neutral-500"># In config.py:</div>
                  <div>DEFAULT_CAMERA_SOURCE = 1  <span className="text-neutral-500"># Change from 0 to 1 or 2</span></div>
                </div>
              </div>

              {/* Step 3: Windows DirectShow Fix */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-neutral-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">3</span>
                  Windows OpenCV DirectShow Optimization:
                </div>
                <p className="text-neutral-400">
                  On Windows 10 & 11, OpenCV default MSMF backend can take 30s to open or give a black screen. In <code className="text-sky-300 font-mono">camera.py</code>, we have enabled <code className="text-emerald-400 font-mono">cv2.CAP_DSHOW</code>:
                </p>
                <div className="bg-black/90 p-3 rounded-lg font-mono text-xs text-neutral-300 border border-neutral-800">
                  <span className="text-sky-400">self.cap</span> = cv2.VideoCapture(src, cv2.CAP_DSHOW)
                </div>
              </div>

              {/* Step 4: Linux Permissions */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-neutral-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">4</span>
                  Linux / Raspberry Pi Camera Group Permission:
                </div>
                <p className="text-neutral-400">
                  If running on Ubuntu or Raspberry Pi, ensure your user has permission to access <code className="text-neutral-300 font-mono">/dev/video*</code>:
                </p>
                <div className="bg-black/90 p-2.5 rounded-lg font-mono text-xs text-sky-300 border border-neutral-800">
                  <code>sudo usermod -aG video $USER</code>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ESP32-CAM & WI-FI STREAMS */}
          {activeTab === 'wifi' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                <h4 className="font-bold text-neutral-100 flex items-center gap-2 text-sm">
                  <Wifi className="w-4 h-4 text-sky-400" />
                  Understanding Browser Mixed Content with Wi-Fi Cameras
                </h4>
                <p className="text-neutral-400 leading-relaxed">
                  When accessing this dashboard over <strong>HTTPS</strong> (cloud preview or secure server), browsers will block direct requests to unencrypted local IP addresses like <code className="text-amber-300 font-mono">http://192.168.1.50:81/stream</code> due to the <strong>W3C Mixed Content Security Policy</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <div className="font-bold text-sky-300">Solution A: Use in Python Project</div>
                  <p className="text-neutral-400 text-[11px]">
                    The Python application (<code className="text-neutral-300">python main.py</code>) runs directly on your local operating system and has <strong>ZERO browser restrictions</strong>. It can connect directly to any ESP32-CAM or RTSP URL without issue!
                  </p>
                </div>

                <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-300">Solution B: Use Phone Camera in Browser</div>
                  <p className="text-neutral-400 text-[11px]">
                    Open this web dashboard directly on your smartphone browser! It accesses your phone&apos;s camera directly with no local network routing required.
                  </p>
                </div>
              </div>

              {/* Tested Wi-Fi Stream Formats */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                <h5 className="font-semibold text-neutral-200">Standard Camera URL Cheat Sheet:</h5>
                <div className="space-y-2 font-mono text-[11px]">
                  <div className="p-2 bg-neutral-900 rounded border border-neutral-800 flex justify-between items-center">
                    <div>
                      <span className="text-sky-400">ESP32-CAM (MJPEG Stream):</span>
                      <div className="text-neutral-300">http://192.168.1.50:81/stream</div>
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-900 rounded border border-neutral-800 flex justify-between items-center">
                    <div>
                      <span className="text-sky-400">ESP32-CAM (High-Res Snapshot):</span>
                      <div className="text-neutral-300">http://192.168.1.50/cam-hi.jpg</div>
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-900 rounded border border-neutral-800 flex justify-between items-center">
                    <div>
                      <span className="text-sky-400">Android IP Webcam App:</span>
                      <div className="text-neutral-300">http://192.168.1.100:8080/video</div>
                    </div>
                  </div>

                  <div className="p-2 bg-neutral-900 rounded border border-neutral-800 flex justify-between items-center">
                    <div>
                      <span className="text-sky-400">RTSP CCTV Stream:</span>
                      <div className="text-neutral-300">rtsp://admin:pass@192.168.1.64:554/h264Preview_01_main</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: USE PHONE AS LIVE CAMERA */}
          {activeTab === 'mobile' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                <h4 className="font-bold text-neutral-100 flex items-center gap-2 text-sm">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  Turn Any Smartphone into Your Project Camera (Easiest & Highest Quality)
                </h4>
                <p className="text-neutral-400 leading-relaxed">
                  Smartphones have 1080p/4K high-resolution cameras that are much better than laptop webcams. Here are the 2 fastest ways to use your phone for FireGuard AI:
                </p>
              </div>

              {/* Method 1 */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  Method 1: Open This Dashboard Directly on Your Phone
                </div>
                <p className="text-neutral-400 text-[11px]">
                  Copy the URL of this application and open it in Google Chrome or Safari on your Android or iPhone. The dashboard will use your phone&apos;s rear or front camera directly in full HD!
                </p>
                <div className="p-2.5 bg-neutral-900 rounded border border-neutral-800 text-[11px] text-neutral-300">
                  Tip: Use the &quot;Flip Camera&quot; button on the video feed to switch to the back camera for detecting real or simulated flames on your desk.
                </div>
              </div>

              {/* Method 2 */}
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  Method 2: Use DroidCam or Camo (Creates a Real USB Webcam)
                </div>
                <p className="text-neutral-400 text-[11px]">
                  Install <strong>DroidCam</strong> (free) or <strong>Camo</strong> on your phone and PC. It connects via Wi-Fi or USB cable and appears as a real USB webcam in both this web dashboard and your Python OpenCV script!
                </p>
                <ul className="list-disc list-inside text-neutral-400 text-[11px] space-y-1 pl-1">
                  <li>Works identically to a 1080p Logitech webcam</li>
                  <li>Zero lag over USB or Wi-Fi</li>
                  <li>Fully compatible with <code className="text-sky-300 font-mono">cv2.VideoCapture(0)</code> and <code className="text-sky-300 font-mono">cv2.VideoCapture(1)</code></li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between text-xs">
          <div className="text-neutral-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>All diagnostics live in-memory</span>
          </div>
          <button
            onClick={() => {
              stopTestStream();
              onClose();
            }}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs transition-colors"
          >
            Done & Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
