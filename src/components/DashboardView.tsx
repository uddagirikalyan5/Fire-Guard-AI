import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Square, Flame, Camera as CameraIcon, Shield, Radio,
  Maximize2, VolumeX, AlertTriangle, Cpu, Send, RefreshCw, Layers, CheckCircle2,
  Grid2X2, Eye, Wifi, Smartphone, RotateCw, Trash2, Zap, Wrench, Droplets, Wind,
  Terminal, Activity, Check, XCircle
} from 'lucide-react';
import { Camera, AppSettings, DetectionEvent, BoundingBox, ArduinoConnectionStatus, SerialLog } from '../types';
import { detectFireInCanvas } from '../utils/fireDetector';
import { soundAlarm } from '../utils/audioAlarm';
import { drawSimulatedScene, drawCctvOverlay } from '../utils/cctvRenderer';
import { MultiCameraGrid } from './MultiCameraGrid';
import { CameraTroubleshooterModal } from './CameraTroubleshooterModal';

interface DashboardViewProps {
  activeCamera: Camera;
  cameras: Camera[];
  onSelectCamera: (cam: Camera) => void;
  onOpenAddCamera: () => void;
  onOpenAddWifiCamera?: () => void;
  onDeleteDuplicateCameras?: () => void;
  onNavigateToTab?: (tab: string) => void;
  isMonitoring: boolean;
  setIsMonitoring: (val: boolean) => void;
  hasFire: boolean;
  currentConfidence: number;
  currentBboxes: BoundingBox[];
  settings: AppSettings;
  onTriggerFireAlert: (customConfidence?: number, customRoom?: string, hazardType?: 'Fire' | 'Smoke' | 'Fire & Smoke', origin?: string) => void;
  onSilenceAlarm: () => void;
  recentEvents: DetectionEvent[];
  arduinoRelayActive: boolean;
  onToggleArduinoRelay: (state: boolean) => void;
  telegramStatus: { lastSent?: string; count: number };
  hazardType?: 'Fire' | 'Smoke' | 'Fire & Smoke';
  arduinoStatus?: ArduinoConnectionStatus;
  arduinoPortInfo?: string;
  arduinoLastError?: string;
  onConnectArduino?: () => Promise<boolean>;
  onDisconnectArduino?: () => Promise<void>;
  onSendSerialCommand?: (cmd: string) => Promise<void>;
  serialLogs?: SerialLog[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeCamera,
  cameras,
  onSelectCamera,
  onOpenAddCamera,
  onOpenAddWifiCamera,
  onDeleteDuplicateCameras,
  onNavigateToTab,
  isMonitoring,
  setIsMonitoring,
  hasFire,
  currentConfidence,
  currentBboxes,
  settings,
  onTriggerFireAlert,
  onSilenceAlarm,
  recentEvents,
  arduinoRelayActive,
  onToggleArduinoRelay,
  telegramStatus,
  hazardType = 'Fire',
  arduinoStatus = 'disconnected',
  arduinoPortInfo = '',
  arduinoLastError = '',
  onConnectArduino,
  onDisconnectArduino,
  onSendSerialCommand,
  serialLogs = []
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ipImgRef = useRef<HTMLImageElement | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(30);
  const [inferenceTime, setInferenceTime] = useState<number>(12);
  const [isSimulatedFireActive, setIsSimulatedFireActive] = useState<boolean>(false);
  const [simulatedHazard, setSimulatedHazard] = useState<'none' | 'fire' | 'smoke'>('none');
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [cameraSwitching, setCameraSwitching] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('single');
  const [showTroubleshooter, setShowTroubleshooter] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => localStorage.getItem('fireguard_preferred_device_id') || '');
  const [availableVideoDevices, setAvailableVideoDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Check if camera is RTSP mobile/IP camera
  const isRtspCamera = activeCamera.wifiSubtype === 'rtsp_ip' || (!!activeCamera.url && activeCamera.url.startsWith('rtsp://'));

  // Stream source: 'device' (webcam/phone camera) | 'ip_network' (direct WiFi/RTSP stream URL) | 'simulation' (test scene)
  const [streamSource, setStreamSource] = useState<'device' | 'ip_network' | 'simulation'>(() => {
    if (activeCamera.type === 'usb') {
      return 'device';
    }
    if (activeCamera.wifiSubtype === 'rtsp_ip' || (activeCamera.url && activeCamera.url.startsWith('rtsp://'))) {
      return 'ip_network';
    }
    if (activeCamera.useLiveDeviceCamera === false) {
      return 'ip_network';
    }
    if (activeCamera.url && activeCamera.url.startsWith('http')) {
      return 'ip_network';
    }
    return 'device';
  });

  // Mobile camera flip: front ('user') vs rear ('environment')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [ipStreamLoaded, setIpStreamLoaded] = useState<boolean>(false);
  const [ipStreamError, setIpStreamError] = useState<boolean>(false);
  const [snapshotCounter, setSnapshotCounter] = useState<number>(0);

  // RTSP backend connection status and states
  const [rtspStatus, setRtspStatus] = useState<'connecting' | 'connected' | 'streaming' | 'failed' | 'reconnecting' | 'stopped' | null>(null);
  const [rtspError, setRtspError] = useState<string | null>(null);
  const [rtspFps, setRtspFps] = useState<number>(0);
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean>(true);
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  // Check FFmpeg availability on server
  useEffect(() => {
    fetch('/api/rtsp/health')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.ffmpegAvailable === 'boolean') {
          setFfmpegAvailable(data.ffmpegAvailable);
        }
      })
      .catch(() => {});
  }, []);

  // Poll RTSP backend status whenever an RTSP camera is active in network mode
  useEffect(() => {
    if (!isRtspCamera || streamSource !== 'ip_network' || !activeCamera.url) return;

    let isMounted = true;
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/rtsp/status?url=${encodeURIComponent(activeCamera.url)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (data.status) {
          setRtspStatus(data.status);
          if (data.status === 'streaming') {
            setIpStreamLoaded(true);
            setIpStreamError(false);
          } else if (data.status === 'failed') {
            setIpStreamError(true);
          }
        }
        if (data.error) setRtspError(data.error);
        if (typeof data.fps === 'number') setRtspFps(data.fps);
        if (typeof data.ffmpegAvailable === 'boolean') setFfmpegAvailable(data.ffmpegAvailable);
      } catch {
        // network or server poll error
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isRtspCamera, streamSource, activeCamera.url, reconnectCount]);

  // Discover and list available video input devices
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoInputs = devices
          .filter(d => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${i + 1}`
          }));
        setAvailableVideoDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          // If a preferred device isn't set, default to first available
          const preferred = localStorage.getItem('fireguard_preferred_device_id');
          if (preferred && videoInputs.some(v => v.deviceId === preferred)) {
            setSelectedDeviceId(preferred);
          }
        }
      }).catch(() => {});
    }
  }, [streamActive, retryTrigger]);

  // Sync stream source whenever active camera changes
  useEffect(() => {
    setIpStreamLoaded(false);
    setIpStreamError(false);
    setRtspStatus(null);
    setRtspError(null);
    const isRtsp = activeCamera.wifiSubtype === 'rtsp_ip' || (!!activeCamera.url && activeCamera.url.startsWith('rtsp://'));
    if (activeCamera.type === 'usb') {
      setStreamSource('device');
    } else if (isRtsp || activeCamera.useLiveDeviceCamera === false || (activeCamera.url && activeCamera.url.startsWith('http'))) {
      setStreamSource('ip_network');
    } else {
      setStreamSource('device');
    }
  }, [activeCamera.id, activeCamera.type, activeCamera.useLiveDeviceCamera, activeCamera.url, activeCamera.wifiSubtype]);

  // Periodic frame poll if URL is a snapshot (e.g. shot.jpg or cam-hi.jpg)
  useEffect(() => {
    if (streamSource !== 'ip_network' || !activeCamera.url || !activeCamera.url.startsWith('http')) return;
    const isSnapshot = activeCamera.url.includes('shot.jpg') || activeCamera.url.includes('.jpg') || activeCamera.url.includes('.jpeg');
    if (isSnapshot) {
      const interval = setInterval(() => {
        setSnapshotCounter(prev => prev + 1);
      }, 200);
      return () => clearInterval(interval);
    }
  }, [activeCamera.url, streamSource]);

  // Handle live device camera stream start/stop with progressive multi-tier constraint fallback
  useEffect(() => {
    let isCancelled = false;
    let currentStream: MediaStream | null = null;
    const shouldStream = isMonitoring && streamSource === 'device';

    if (shouldStream) {
      setCameraSwitching(true);

      const requestStream = async () => {
        const profiles: MediaStreamConstraints[] = [
          // Profile 1: Preferred device or facingMode with HD 720p
          {
            video: {
              deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
              facingMode: selectedDeviceId ? undefined : { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          },
          // Profile 2: Preferred device or facingMode without resolution constraints
          {
            video: {
              deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
              facingMode: selectedDeviceId ? undefined : { ideal: facingMode }
            },
            audio: false
          },
          // Profile 3: Generic video device with deviceId if set
          {
            video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
            audio: false
          },
          // Profile 4: Absolute basic fallback
          {
            video: true,
            audio: false
          }
        ];

        let stream: MediaStream | null = null;
        let lastError: any = null;

        for (const prof of profiles) {
          if (isCancelled) return;
          try {
            stream = await navigator.mediaDevices.getUserMedia(prof);
            if (stream) break;
          } catch (err: any) {
            lastError = err;
          }
        }

        if (isCancelled) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (stream) {
          currentStream = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setStreamActive(true);
          setCameraError(null);
          setCameraSwitching(false);
        } else {
          const errName = lastError?.name || 'Error';
          let humanMsg = 'Live device camera access not granted or unavailable.';
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            humanMsg = 'Camera permission blocked. Click the lock/settings icon in your browser address bar to allow camera access, or click "Troubleshoot Camera".';
          } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            humanMsg = 'Camera is currently locked by another program (Zoom, Teams, OBS, Skype, or another tab). Close other camera apps and retry.';
          } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            humanMsg = 'No camera hardware found on this computer. Please plug in a USB webcam or use your phone camera.';
          } else if (errName === 'OverconstrainedError') {
            humanMsg = 'Camera resolution constraint not supported. Using standard compatibility mode.';
          }
          console.warn('Camera stream error:', humanMsg, lastError);
          setCameraError(humanMsg);
          setStreamActive(false);
          setCameraSwitching(false);
        }
      };

      requestStream();
    } else {
      setStreamActive(false);
      setCameraError(null);
    }

    return () => {
      isCancelled = true;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeCamera.id, streamSource, isMonitoring, facingMode, selectedDeviceId, retryTrigger]);

  // Animation frame loop for video rendering and AI inference
  useEffect(() => {
    let animationFrameId: number;
    let frameCount = 0;
    let fpsTimer = performance.now();

    const renderLoop = () => {
      const now = performance.now();
      frameCount++;
      if (now - fpsTimer >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTimer = now;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;

          // 1. Draw Feed Frame (Live Device Camera OR Wi-Fi IP Stream OR Safety Scene)
          let drewLiveFrame = false;

          if (streamSource === 'device' && streamActive && videoRef.current && videoRef.current.readyState >= 2) {
            try {
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              drewLiveFrame = true;
            } catch {
              // Frame draw error fallback
            }
          } else if (streamSource === 'ip_network' && ipImgRef.current && (ipStreamLoaded || isRtspCamera) && ipImgRef.current.naturalWidth > 0) {
            try {
              ctx.drawImage(ipImgRef.current, 0, 0, w, h);
              drewLiveFrame = true;
            } catch {
              // Cross-origin tainted canvas fallback
            }
          }

          if (!drewLiveFrame) {
            drawSimulatedScene(ctx, w, h, 'wifi_cam', isSimulatedFireActive, now);
          }

          // 2. If monitoring is active, run AI detection heuristics on canvas
          if (isMonitoring) {
            const result = detectFireInCanvas(
              ctx,
              w,
              h,
              settings.confidenceThreshold,
              simulatedHazard === 'fire' || (isSimulatedFireActive && simulatedHazard !== 'smoke'),
              simulatedHazard === 'smoke'
            );

            setInferenceTime(result.processingTimeMs);

            // Draw bounding boxes on canvas (Red: Fire, Cyan: Human/Person, Amber: Smoke)
            const boxesToDraw = result.boxes.length > 0 ? result.boxes : currentBboxes;
            for (const box of boxesToDraw) {
              const isHuman = box.label.toLowerCase().includes('human') || box.label.toLowerCase().includes('person');
              const isSmoke = box.label.toLowerCase().includes('smoke');
              const boxColor = box.color || (isHuman ? '#38bdf8' : isSmoke ? '#f59e0b' : '#ef4444');
              const fillColor = isHuman ? 'rgba(56, 189, 248, 0.20)' : isSmoke ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.20)';

              // Bounding box frame
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // Semi-transparent highlight
              ctx.fillStyle = fillColor;
              ctx.fillRect(box.x, box.y, box.width, box.height);

              // Label badge
              const labelText = `${box.label}: ${box.confidence}%`;
              ctx.font = 'bold 12px "JetBrains Mono", monospace';
              const textWidth = ctx.measureText(labelText).width;
              
              ctx.fillStyle = boxColor;
              ctx.fillRect(box.x, Math.max(0, box.y - 22), textWidth + 12, 22);

              ctx.fillStyle = isHuman ? '#000000' : '#ffffff';
              ctx.fillText(labelText, box.x + 6, Math.max(15, box.y - 6));
            }

            // If either Fire OR Smoke detected from canvas & confidence exceeds threshold -> Auto-Trigger Pump
            if ((result.hasFire || result.hasSmoke) && result.confidence >= settings.confidenceThreshold) {
              const detectedType = result.hasFire && result.hasSmoke ? 'Fire & Smoke' : result.hasFire ? 'Fire' : 'Smoke';
              onTriggerFireAlert(result.confidence, activeCamera.room, detectedType);
            }
          }

          // Draw CCTV timestamp overlay in corner
          drawCctvOverlay(ctx, w, h, activeCamera, isMonitoring, fps);
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeCamera, isMonitoring, isSimulatedFireActive, simulatedHazard, streamActive, streamSource, ipStreamLoaded, currentBboxes, settings.confidenceThreshold, onTriggerFireAlert]);

  // Sync simulated hazard state when fire is silenced or cleared externally
  useEffect(() => {
    if (!hasFire) {
      setIsSimulatedFireActive(false);
      setSimulatedHazard('none');
    }
  }, [hasFire]);

  const handleStartMonitoring = () => {
    setIsMonitoring(true);
    soundAlarm.playBeep(880, 0.08);
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    setIsSimulatedFireActive(false);
    setSimulatedHazard('none');
    onSilenceAlarm();
    soundAlarm.playBeep(440, 0.08);
  };

  const handleToggleSimulationFire = () => {
    if (simulatedHazard === 'fire' || hasFire) {
      setSimulatedHazard('none');
      setIsSimulatedFireActive(false);
      onSilenceAlarm(); // Sends FIRE_OFF to Arduino -> Turns Pump OFF
    } else {
      setSimulatedHazard('fire');
      setIsSimulatedFireActive(true);
      setIsMonitoring(true);
      // Calls unified hardware function with 'Simulate Fire Button' -> Sends FIRE_ON to Arduino -> Turns Pump ON
      onTriggerFireAlert(96, activeCamera.room, 'Fire', 'Simulate Fire Button');
    }
  };

  const handleToggleSimulationSmoke = () => {
    if (simulatedHazard === 'smoke' || hasFire) {
      setSimulatedHazard('none');
      setIsSimulatedFireActive(false);
      onSilenceAlarm(); // Sends FIRE_OFF to Arduino -> Turns Pump OFF
    } else {
      setSimulatedHazard('smoke');
      setIsSimulatedFireActive(true);
      setIsMonitoring(true);
      // Calls unified hardware function with 'Simulate Smoke Button' -> Sends FIRE_ON to Arduino -> Turns Pump ON
      onTriggerFireAlert(91, activeCamera.room, 'Smoke', 'Simulate Smoke Button');
    }
  };

  const handleCaptureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `FireGuard_${activeCamera.room.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
    a.click();
    soundAlarm.playBeep(1200, 0.05);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Banner Alert if Fire Active */}
      {hasFire && (
        <div className="p-3.5 bg-red-950/90 border-2 border-red-600 rounded-xl text-white flex items-center justify-between alarm-pulse shadow-xl shadow-red-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-bold animate-bounce">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-wide text-red-100">
                  CRITICAL FIRE EMERGENCY DETECTED
                </span>
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded font-mono font-bold">
                  {currentConfidence}% CONFIDENCE
                </span>
              </div>
              <p className="text-xs text-red-200">
                Location: <strong className="text-white underline">{activeCamera.room}</strong> | Arduino Relay Activated | Telegram Alert Dispatched
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-silence-alarm-banner"
              onClick={onSilenceAlarm}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg border border-neutral-700 transition-colors flex items-center gap-1.5"
            >
              <VolumeX className="w-4 h-4 text-red-400" />
              <span>Silence Siren</span>
            </button>
          </div>
        </div>
      )}

      {/* View Mode & Camera Surveillance Selector Bar */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
          <button
            id="btn-view-single"
            onClick={() => setViewMode('single')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'single'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Single Camera Focus</span>
          </button>

          <button
            id="btn-view-multi"
            onClick={() => setViewMode('multi')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'multi'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Grid2X2 className="w-3.5 h-3.5" />
            <span>Simultaneous Multi-Camera Matrix</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-900 text-red-300 border border-neutral-700 font-mono">
              {cameras.length} Feeds
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-neutral-400 font-mono hidden sm:inline">
            Status: <strong className={isMonitoring ? 'text-emerald-400' : 'text-neutral-400'}>{isMonitoring ? 'LIVE MONITORING' : 'STANDBY'}</strong>
          </span>

          {onOpenAddWifiCamera && (
            <button
              id="btn-header-add-wifi-camera"
              onClick={onOpenAddWifiCamera}
              className="px-3 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl shadow-md shadow-sky-950/40 flex items-center gap-1.5 text-xs font-semibold border border-sky-400/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Add Smartphone, ESP32-CAM or Wireless IP Camera to Homescreen"
            >
              <Wifi className="w-3.5 h-3.5 text-sky-200 animate-pulse" />
              <span>+ Add Wi-Fi Camera</span>
            </button>
          )}

          <button
            id="btn-header-add-camera"
            onClick={onOpenAddCamera}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl border border-neutral-700 flex items-center gap-1 text-xs"
          >
            <CameraIcon className="w-3.5 h-3.5" />
            <span>Manage Feeds</span>
          </button>

          {onNavigateToTab && (
            <button
              id="btn-header-view-circuit"
              onClick={() => onNavigateToTab('circuit')}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-emerald-300 rounded-xl border border-neutral-700 flex items-center gap-1.5 text-xs font-medium transition-colors"
              title="Open IoT Devices Circuit Diagram & Wiring Guide"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">IoT Circuit</span>
            </button>
          )}

          {onDeleteDuplicateCameras && (
            <button
              id="btn-header-clean-duplicates"
              onClick={onDeleteDuplicateCameras}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-amber-300 rounded-xl border border-neutral-700 flex items-center gap-1 text-xs transition-colors"
              title="Delete any duplicate cameras or redundant entries"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Clean Duplicates</span>
            </button>
          )}

          <button
            id="btn-header-troubleshoot-camera"
            onClick={() => setShowTroubleshooter(true)}
            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white rounded-xl shadow-md border border-amber-400/40 flex items-center gap-1.5 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Camera not working? Run live diagnostics, fix permissions, and test devices"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-200" />
            <span>Camera Fix & Doctor</span>
          </button>
        </div>
      </div>

      {viewMode === 'multi' ? (
        <MultiCameraGrid
          cameras={cameras}
          isMonitoring={isMonitoring}
          setIsMonitoring={setIsMonitoring}
          onFocusCamera={(cam) => {
            onSelectCamera(cam);
            setViewMode('single');
          }}
          onOpenAddCamera={onOpenAddCamera}
          onOpenAddWifiCamera={onOpenAddWifiCamera}
          settings={settings}
          onTriggerFireAlert={onTriggerFireAlert}
          onSilenceAlarm={onSilenceAlarm}
          hasFire={hasFire}
          currentConfidence={currentConfidence}
          activeFireRoom={activeCamera.room}
          onSwitchToSingleView={(cam) => {
            if (cam) onSelectCamera(cam);
            setViewMode('single');
          }}
        />
      ) : (
        /* Main Grid: Left CCTV Feed (65%) + Right Security Info Panel (35%) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Video Feed Console */}
        <div className="lg:col-span-8 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 shadow-xl flex flex-col">
          {/* Feed Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
              <div>
                <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                  <span>{activeCamera.name}</span>
                  {activeCamera.type === 'wifi_ip' ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800/60 flex items-center gap-1 font-semibold">
                      <Wifi className="w-3 h-3 text-sky-400" />
                      <span>WI-FI CAM ({activeCamera.wifiSignalDbm || -55} dBm)</span>
                    </span>
                  ) : (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                      {activeCamera.type.toUpperCase()}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                  <span>Room: <strong className="text-sky-400">{activeCamera.room}</strong></span>
                  {activeCamera.type === 'wifi_ip' && (
                    <span className="text-[11px] text-neutral-400 truncate max-w-[260px]">
                      • URL: <span className="text-sky-300">{activeCamera.url}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Camera Switcher Dropdown */}
            <div className="flex items-center gap-2">
              <select
                id="select-camera-quick-switch"
                value={activeCamera.id}
                onChange={(e) => {
                  const selected = cameras.find(c => c.id === e.target.value);
                  if (selected) onSelectCamera(selected);
                }}
                className="bg-neutral-950 border border-neutral-700 text-xs text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-red-500 font-mono"
              >
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id}>
                    {cam.name} ({cam.room})
                  </option>
                ))}
              </select>

              <button
                id="btn-switch-to-multicam"
                onClick={() => setViewMode('multi')}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-400 rounded-lg text-xs border border-neutral-700 flex items-center gap-1 font-medium"
                title="View all cameras simultaneously"
              >
                <Grid2X2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Multi-Cam</span>
              </button>

              <button
                id="btn-manage-cameras"
                onClick={onOpenAddCamera}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700"
                title="Manage Cameras"
              >
                <CameraIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Video Stream Stage */}
          <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-neutral-800 shadow-inner flex items-center justify-center">
            {/* Hidden Video element for USB / Device webcam input */}
            <video ref={videoRef} className="hidden" playsInline muted autoPlay />

            {/* Hidden Image element for Wi-Fi IP / RTSP MJPEG stream decoding */}
            {activeCamera.url && (activeCamera.url.startsWith('http') || isRtspCamera) && (
              <img
                ref={ipImgRef}
                src={
                  isRtspCamera
                    ? `/api/rtsp/stream?url=${encodeURIComponent(activeCamera.url)}&_t=${reconnectCount}`
                    : activeCamera.url.includes('shot.jpg') || activeCamera.url.includes('.jpg')
                    ? `${activeCamera.url}${activeCamera.url.includes('?') ? '&' : '?'}_t=${snapshotCounter}`
                    : activeCamera.url
                }
                crossOrigin="anonymous"
                className="hidden"
                alt="IP/RTSP Stream Feed"
                onLoad={() => {
                  setIpStreamLoaded(true);
                  setIpStreamError(false);
                }}
                onError={() => {
                  setIpStreamError(true);
                  setIpStreamLoaded(false);
                }}
              />
            )}

            {/* Canvas for video decoding, bounding box overlay, and fire simulation */}
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              className="w-full h-full object-contain"
            />

            {/* Live Camera Source Toolbar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-20 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-neutral-950/85 backdrop-blur-md px-2.5 py-1 rounded-xl border border-neutral-700/80 text-[11px] font-mono shadow-lg">
                <span className={`w-2 h-2 rounded-full ${
                  streamActive || (streamSource === 'ip_network' && (ipStreamLoaded || rtspStatus === 'streaming'))
                    ? 'bg-emerald-400 animate-ping'
                    : rtspStatus === 'connecting' || rtspStatus === 'reconnecting'
                    ? 'bg-amber-400 animate-pulse'
                    : rtspStatus === 'failed' || ipStreamError
                    ? 'bg-red-500'
                    : 'bg-sky-400'
                }`} />
                <span className="text-neutral-200 font-bold">
                  {streamSource === 'device' && streamActive
                    ? 'LIVE DEVICE STREAM ACTIVE'
                    : isRtspCamera && streamSource === 'ip_network'
                    ? `RTSP: ${rtspStatus ? rtspStatus.toUpperCase() : 'CONNECTING'}${rtspFps ? ` (${rtspFps} FPS)` : ''}`
                    : streamSource === 'ip_network' && ipStreamLoaded
                    ? 'LIVE WI-FI IP STREAM'
                    : activeCamera.name}
                </span>
                {activeCamera.room && (
                  <span className="text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-[10px]">
                    📍 {activeCamera.room}
                  </span>
                )}
                {activeCamera.url && (
                  <span className="text-sky-300 font-medium truncate max-w-[200px] hidden sm:inline text-[10px]">
                    ({activeCamera.url})
                  </span>
                )}
              </div>

              {/* Stream Switcher Buttons: Live Device Cam vs Wi-Fi IP / RTSP Stream */}
              <div className="flex items-center gap-1.5 bg-neutral-950/85 backdrop-blur-md p-1 rounded-xl border border-neutral-700/80 shadow-lg text-xs">
                {/* Hardware camera device picker if multiple cameras found */}
                {streamSource === 'device' && availableVideoDevices.length > 1 && (
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      localStorage.setItem('fireguard_preferred_device_id', e.target.value);
                      setRetryTrigger(prev => prev + 1);
                    }}
                    className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-[11px] rounded px-1.5 py-1 max-w-[130px] truncate focus:outline-none focus:border-sky-500 font-mono"
                    title="Select Video Capture Device"
                  >
                    {availableVideoDevices.map((dev, i) => (
                      <option key={dev.deviceId || i} value={dev.deviceId}>
                        {dev.label}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  id="btn-source-device"
                  onClick={() => {
                    setStreamSource('device');
                    setIsMonitoring(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                    streamSource === 'device'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Use Laptop Webcam or Smartphone Camera as Live Feed"
                >
                  <CameraIcon className="w-3 h-3" />
                  <span>Device Cam</span>
                </button>

                {activeCamera.url && (activeCamera.url.startsWith('http') || isRtspCamera) && (
                  <button
                    id="btn-source-ip"
                    onClick={() => {
                      setStreamSource('ip_network');
                      setIsMonitoring(true);
                      if (isRtspCamera) {
                        fetch('/api/rtsp/start', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ rtspUrl: activeCamera.url, room: activeCamera.room, name: activeCamera.name })
                        }).catch(() => {});
                        setReconnectCount(prev => prev + 1);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      streamSource === 'ip_network'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                    title={isRtspCamera ? "Mobile RTSP Camera via backend FFmpeg transcode" : "Direct Network Wi-Fi Stream (MJPEG / HTTP)"}
                  >
                    <Wifi className="w-3 h-3" />
                    <span>{isRtspCamera ? 'RTSP Stream' : 'Wi-Fi IP'}</span>
                  </button>
                )}

                {/* Flip camera toggle for mobile / multi-camera devices */}
                {streamSource === 'device' && (
                  <button
                    id="btn-flip-camera"
                    onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                    className="p-1 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                    title={`Flip Camera (Currently: ${facingMode === 'user' ? 'Front' : 'Rear'})`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Quick Troubleshoot Button */}
                <button
                  id="btn-toolbar-troubleshoot"
                  onClick={() => setShowTroubleshooter(true)}
                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-amber-300 hover:text-amber-200 border border-neutral-700/80 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Troubleshoot & Fix Camera Not Working"
                >
                  <Wrench className="w-3 h-3 text-amber-400" />
                  <span className="hidden sm:inline">Fix Cam</span>
                </button>
              </div>
            </div>

            {/* Missing FFmpeg Warning Notice for RTSP */}
            {isRtspCamera && streamSource === 'ip_network' && !ffmpegAvailable && (
              <div className="absolute inset-x-4 top-14 p-3 bg-neutral-950/95 border-2 border-amber-500 rounded-xl backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-30">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-amber-200">FFmpeg Not Detected On Server</p>
                    <p className="text-[11px] text-neutral-300">
                      RTSP video stream conversion requires FFmpeg. On Windows, open PowerShell and run: <code className="bg-neutral-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">winget install Gyan.FFmpeg</code>, then restart the server.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStreamSource('device')}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold shrink-0"
                >
                  Use Device Cam Instead
                </button>
              </div>
            )}

            {/* RTSP Connecting Status Indicator */}
            {isRtspCamera && streamSource === 'ip_network' && ffmpegAvailable && (rtspStatus === 'connecting' || rtspStatus === 'reconnecting') && (
              <div className="absolute inset-x-6 top-16 p-3 bg-neutral-950/90 border border-sky-600/70 rounded-xl backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 text-xs z-30">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                  <div>
                    <p className="font-semibold text-neutral-100">
                      {rtspStatus === 'reconnecting' ? 'Reconnecting RTSP Stream...' : 'Connecting to RTSP Mobile Camera...'}
                    </p>
                    <p className="text-[11px] text-neutral-400 font-mono truncate max-w-sm">
                      {activeCamera.url}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-sky-950 text-sky-300 border border-sky-800/60 font-mono">
                  FFmpeg relaying
                </span>
              </div>
            )}

            {/* RTSP Stream Failed / Connection Error Overlay */}
            {isRtspCamera && streamSource === 'ip_network' && (rtspStatus === 'failed' || ipStreamError) && (
              <div className="absolute inset-x-4 top-14 p-4 bg-neutral-950/95 border-2 border-red-600/90 rounded-xl backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                  <div>
                    <p className="font-bold text-red-200">Mobile RTSP Connection Failed</p>
                    <p className="text-[11px] text-neutral-300 mt-0.5">
                      {rtspError || `Could not connect to RTSP stream at ${activeCamera.url}. Check that phone/camera is on the same Wi-Fi network and RTSP server is running.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      fetch('/api/rtsp/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rtspUrl: activeCamera.url, room: activeCamera.room, name: activeCamera.name })
                      }).catch(() => {});
                      setReconnectCount(c => c + 1);
                      setIpStreamError(false);
                      setRtspStatus('connecting');
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry RTSP</span>
                  </button>
                  <button
                    onClick={() => setStreamSource('device')}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg text-xs"
                  >
                    Use Device Cam
                  </button>
                </div>
              </div>
            )}

            {/* Generic Insecure Mixed Content / Connection Warning Fallback for standard HTTP IP Stream */}
            {!isRtspCamera && streamSource === 'ip_network' && ipStreamError && (
              <div className="absolute inset-x-4 top-14 p-3 bg-neutral-950/90 border border-amber-600/70 rounded-xl backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-30">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-neutral-100">Direct Local Wi-Fi Stream Notice</p>
                    <p className="text-[11px] text-neutral-400">
                      Local URL <code className="text-amber-300">{activeCamera.url}</code> cannot load directly in HTTPS iframes. Stream live via your Device/Phone Camera instead!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="btn-open-troubleshooter-from-wifi"
                    onClick={() => setShowTroubleshooter(true)}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-semibold rounded-lg text-xs flex items-center gap-1 border border-neutral-700"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Troubleshoot</span>
                  </button>
                  <button
                    id="btn-switch-to-device-cam-fallback"
                    onClick={() => setStreamSource('device')}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow"
                  >
                    <CameraIcon className="w-3.5 h-3.5" />
                    <span>Switch to Live Camera</span>
                  </button>
                </div>
              </div>
            )}

            {/* Scanning line animation */}
            {isMonitoring && (
              <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-scanline" />
              </div>
            )}

            {/* Live Water Extinguisher Pump HUD Badge */}
            {arduinoRelayActive && (
              <div className="absolute top-14 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/95 border border-cyan-400 text-cyan-200 text-xs font-bold shadow-2xl animate-pulse backdrop-blur-md">
                <Droplets className="w-4 h-4 text-cyan-400 animate-bounce" />
                <span>PUMP ON: WATER EXTINGUISHER ACTIVE</span>
              </div>
            )}

            {/* Standby Overlay when Monitoring is OFF */}
            {!isMonitoring && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="w-14 h-14 rounded-2xl bg-neutral-900/90 border border-neutral-700 flex items-center justify-center text-neutral-400 mb-3">
                  <Radio className="w-7 h-7 text-neutral-500" />
                </div>
                <h3 className="text-base font-semibold text-neutral-200">Surveillance Feed on Standby</h3>
                <p className="text-xs text-neutral-400 max-w-sm mt-1 mb-4">
                  AI YOLOv8 inference is currently paused. Press &quot;Start Monitoring&quot; to begin continuous fire and smoke recognition.
                </p>
                <button
                  id="btn-start-monitoring-overlay"
                  onClick={handleStartMonitoring}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/40 border border-emerald-500/40"
                >
                  <Play className="w-4 h-4" />
                  <span>START MONITORING FEED</span>
                </button>
              </div>
            )}

            {/* Actionable Error Card when Camera Access Fails */}
            {cameraError && streamSource === 'device' && (
              <div className="absolute bottom-3 left-3 right-3 bg-neutral-950/95 border-2 border-red-700/90 text-red-100 text-xs p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md shadow-2xl z-30">
                <div className="flex items-start sm:items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="space-y-0.5">
                    <strong className="block text-white font-semibold flex items-center gap-2">
                      <span>Camera Access Issue</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-800">Device Cam</span>
                    </strong>
                    <p className="text-red-200/90 text-[11px] leading-tight">{cameraError}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    id="btn-retry-camera-stream"
                    onClick={() => {
                      setCameraError(null);
                      setRetryTrigger(prev => prev + 1);
                    }}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-lg text-xs flex items-center gap-1.5 border border-neutral-700 transition-colors"
                    title="Retry camera connection"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                  <button
                    id="btn-fix-camera-modal"
                    onClick={() => setShowTroubleshooter(true)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-red-950/60 border border-red-400/40 transition-all hover:scale-[1.02]"
                    title="Open Camera Troubleshooter & Doctor"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-200" />
                    <span>Fix Camera / Troubleshoot</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Video Control Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              {isMonitoring ? (
                <button
                  id="btn-stop-monitoring"
                  onClick={handleStopMonitoring}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-md transition-colors border border-red-500/40"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>STOP MONITORING</span>
                </button>
              ) : (
                <button
                  id="btn-start-monitoring-bottom"
                  onClick={handleStartMonitoring}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center gap-2 shadow-md transition-colors border border-emerald-500/40"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>START MONITORING</span>
                </button>
              )}

              {/* Manual Fire Alarm Test Trigger button */}
              <button
                id="btn-trigger-fire-simulation"
                onClick={handleToggleSimulationFire}
                className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all border ${
                  simulatedHazard === 'fire' || (hasFire && hazardType !== 'Smoke')
                    ? 'bg-red-600 text-white border-red-400 animate-pulse shadow-md shadow-red-950/60'
                    : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                }`}
                title="Simulate Fire: Sends FIRE_ON to Arduino Uno & Activates 12V Water Pump"
              >
                <Flame className={`w-3.5 h-3.5 ${simulatedHazard === 'fire' || (hasFire && hazardType !== 'Smoke') ? 'text-white' : 'text-red-400'}`} />
                <span>{simulatedHazard === 'fire' || (hasFire && hazardType !== 'Smoke') ? 'Stop Fire (FIRE_OFF -> Pump OFF)' : '🔥 Simulate Fire (FIRE_ON -> Pump ON)'}</span>
              </button>

              {/* Manual Smoke Alarm Test Trigger button */}
              <button
                id="btn-trigger-smoke-simulation"
                onClick={handleToggleSimulationSmoke}
                className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all border ${
                  simulatedHazard === 'smoke' || (hasFire && hazardType === 'Smoke')
                    ? 'bg-amber-600 text-white border-amber-400 animate-pulse shadow-md shadow-amber-950/60'
                    : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                }`}
                title="Simulate Smoke: Sends FIRE_ON to Arduino Uno & Activates 12V Water Pump"
              >
                <Wind className={`w-3.5 h-3.5 ${simulatedHazard === 'smoke' || (hasFire && hazardType === 'Smoke') ? 'text-white' : 'text-amber-400'}`} />
                <span>{simulatedHazard === 'smoke' || (hasFire && hazardType === 'Smoke') ? 'Stop Smoke (FIRE_OFF -> Pump OFF)' : '💨 Simulate Smoke (FIRE_ON -> Pump ON)'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-capture-snapshot"
                onClick={handleCaptureSnapshot}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-medium rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5"
                title="Save current CCTV screenshot"
              >
                <CameraIcon className="w-3.5 h-3.5 text-neutral-400" />
                <span>Snapshot</span>
              </button>
            </div>
          </div>

          {/* Quick Multi-Camera Switcher Strip */}
          <div className="mt-4 pt-3 border-t border-neutral-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Simultaneous Camera Feeds ({cameras.length})
              </span>
              <button
                id="btn-switch-to-matrix-from-strip"
                onClick={() => setViewMode('multi')}
                className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <Grid2X2 className="w-3.5 h-3.5" />
                <span>Switch to Full Multi-Matrix</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {cameras.map((cam) => {
                const isActive = cam.id === activeCamera.id;
                return (
                  <button
                    key={cam.id}
                    id={`btn-channel-cam-${cam.id}`}
                    onClick={() => onSelectCamera(cam)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      isActive
                        ? 'bg-neutral-800 border-red-500/80 shadow-md ring-1 ring-red-500/40'
                        : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                      <span className="text-[10px] font-mono text-neutral-500 uppercase">{cam.type}</span>
                    </div>
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-neutral-300'}`}>
                      {cam.name}
                    </p>
                    <p className="text-[10px] text-sky-400 font-mono truncate">
                      {cam.room}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Telemetry & Safety Status Panel */}
        <div className="lg:col-span-4 space-y-3">
          {/* Card 1: Real-time Fire Status */}
          <div className={`p-4 rounded-2xl border transition-all ${
            hasFire
              ? 'bg-red-950/80 border-red-600 shadow-lg shadow-red-950/50'
              : isMonitoring
                ? 'bg-neutral-900/90 border-neutral-800'
                : 'bg-neutral-900/50 border-neutral-800/60'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Hazard Telemetry</span>
              <span className={`w-2.5 h-2.5 rounded-full ${hasFire ? 'bg-red-500 animate-ping' : isMonitoring ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                hasFire ? 'bg-red-600 text-white animate-bounce' : 'bg-neutral-800 text-neutral-400'
              }`}>
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className={`text-base font-bold font-display ${hasFire ? 'text-red-300' : 'text-neutral-100'}`}>
                  {hasFire ? '🚨 FIRE HAZARD ACTIVE' : isMonitoring ? 'NORMAL - SECURED' : 'STANDBY IDLE'}
                </h3>
                <p className="text-xs text-neutral-400 font-mono">
                  Room: <span className="text-neutral-200 font-semibold">{activeCamera.room}</span>
                </p>
              </div>
            </div>

            {/* Confidence Progress Bar */}
            <div className="space-y-1.5 pt-2 border-t border-neutral-800">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">AI Confidence:</span>
                <span className={`font-bold ${hasFire ? 'text-red-400' : currentConfidence > 30 ? 'text-amber-400' : 'text-neutral-400'}`}>
                  {currentConfidence}% (Threshold: {settings.confidenceThreshold}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    currentConfidence >= settings.confidenceThreshold
                      ? 'bg-red-600'
                      : currentConfidence > 40
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, currentConfidence)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Arduino Uno Hardware Controller & Relay Link */}
          <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                  Arduino Hardware & Pump Control
                </h4>
              </div>
              {/* Connection Status Badge */}
              {arduinoStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-600/80 text-emerald-300 text-[11px] font-mono font-bold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Arduino Connected
                </span>
              ) : arduinoStatus === 'command_sent' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950 border border-cyan-500 text-cyan-300 text-[11px] font-mono font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Command Sent
                </span>
              ) : arduinoStatus === 'command_failed' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950 border border-red-600 text-red-300 text-[11px] font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Command Failed
                </span>
              ) : arduinoStatus === 'permission_blocked' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950 border border-amber-600 text-amber-300 text-[11px] font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Iframe Restricted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-950 border border-neutral-700 text-neutral-400 text-[11px] font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-neutral-500" />
                  Arduino Disconnected
                </span>
              )}
            </div>

            {/* Arduino COM Port & Connect / Disconnect Buttons */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-neutral-200">USB Serial Port (9600 Baud)</p>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    {arduinoPortInfo || 'No COM port paired'}
                  </p>
                </div>
                <div>
                  {arduinoStatus === 'connected' || arduinoStatus === 'command_sent' ? (
                    <button
                      id="btn-disconnect-arduino"
                      type="button"
                      onClick={onDisconnectArduino}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-red-300 hover:text-red-200 font-semibold text-xs rounded-lg border border-neutral-700 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      id="btn-connect-arduino-main"
                      type="button"
                      onClick={onConnectArduino}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-md shadow-emerald-950/60 border border-emerald-400/40 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Connect Arduino (USB)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Helpful Permission / Sandbox Warning Card if blocked */}
              {(arduinoStatus === 'permission_blocked' || arduinoStatus === 'unsupported') && (
                <div className="p-2.5 bg-amber-950/80 border border-amber-600/70 rounded-lg text-[11px] text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-100">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Browser Security / Web Serial Notice</span>
                  </div>
                  <p className="leading-snug">
                    {arduinoStatus === 'permission_blocked'
                      ? 'Web Serial is restricted inside this preview iframe. Open the app in its own browser tab (or popout window) in Google Chrome or Microsoft Edge to permit USB COM port access.'
                      : 'The Web Serial API requires Google Chrome, Microsoft Edge, or Opera on desktop (Windows, Mac, Linux).'}
                  </p>
                </div>
              )}

              {/* Error message if command failed */}
              {arduinoStatus === 'command_failed' && arduinoLastError && (
                <div className="p-2 bg-red-950/80 border border-red-700/60 rounded-lg text-[11px] text-red-200 flex items-start gap-1.5">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="leading-tight">{arduinoLastError}</span>
                </div>
              )}
            </div>

            {/* Water Extinguisher Pump & Relay Actuator HUD */}
            <div className={`p-3 rounded-xl border text-xs transition-all space-y-2.5 ${
              arduinoRelayActive
                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-100 shadow-xl shadow-cyan-950/60'
                : 'bg-neutral-950 border-neutral-800 text-neutral-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${arduinoRelayActive ? 'bg-cyan-600 text-white animate-bounce' : 'bg-neutral-800 text-neutral-400'}`}>
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-white text-xs">Physical 12V Water Pump</p>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-700 text-neutral-300 font-semibold">
                        Relay Pin 7 (Active LOW)
                      </span>
                    </div>
                    <p className={`text-[11px] font-mono ${arduinoRelayActive ? 'text-cyan-300 font-bold' : 'text-neutral-400'}`}>
                      {arduinoRelayActive ? '⚡ RELAY ENERGIZED: 12V WATER PUMP ON' : 'RELAY DE-ENERGIZED: 12V PUMP OFF'}
                    </p>
                  </div>
                </div>

                <button
                  id="btn-toggle-relay-manual"
                  type="button"
                  onClick={() => onToggleArduinoRelay(!arduinoRelayActive)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-mono font-bold transition-all border shadow-sm ${
                    arduinoRelayActive
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 border-cyan-300 animate-pulse'
                      : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
                  }`}
                  title="Direct Relay Manual Toggle (Sends FIRE_ON / FIRE_OFF over Serial)"
                >
                  {arduinoRelayActive ? '💦 STOP PUMP (FIRE_OFF)' : '▶ TEST PUMP (FIRE_ON)'}
                </button>
              </div>

              {/* Hardware Transmission Flow Guide */}
              <div className="pt-2 border-t border-neutral-800/80 text-[10px] font-mono text-neutral-400 flex items-center justify-between">
                <span>Protocol: <strong>FIRE_ON\n</strong> / <strong>FIRE_OFF\n</strong></span>
                <span className="text-emerald-400 font-semibold">Hardware Synchronized</span>
              </div>
            </div>

            {/* Compact Real-time Hardware Debug / Serial Log Preview */}
            <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <span className="flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-sky-400" />
                  <span>Hardware Serial Transmission Log</span>
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateToTab && onNavigateToTab('relay')}
                  className="text-sky-400 hover:text-sky-300 underline text-[10px]"
                >
                  Open Monitor
                </button>
              </div>

              <div className="font-mono text-[10px] space-y-1 max-h-24 overflow-y-auto bg-black/60 p-2 rounded-lg border border-neutral-900">
                {serialLogs.length === 0 ? (
                  <p className="text-neutral-500">Ready. Click &quot;Simulate Fire&quot; or connect Arduino to view commands.</p>
                ) : (
                  serialLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="flex items-start gap-1 leading-tight">
                      <span className="text-neutral-500 shrink-0">[{log.timestamp}]</span>
                      <span className={`font-bold shrink-0 ${
                        log.type === 'TX'
                          ? 'text-sky-400'
                          : log.type === 'RX'
                          ? 'text-emerald-400'
                          : log.type === 'ERR'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}>
                        [{log.type}]
                      </span>
                      <span className={`truncate ${
                        log.type === 'ERR' ? 'text-red-300' : 'text-neutral-300'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Recent Incident Activity */}
          <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Recent Incident Log</h4>
              <span className="text-[10px] font-mono text-neutral-500">SQLite events</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {recentEvents.length === 0 ? (
                <p className="text-xs text-neutral-500 py-3 text-center">No recent fire events logged.</p>
              ) : (
                recentEvents.slice(0, 3).map((evt) => (
                  <div key={evt.id} className="p-2 bg-neutral-950 rounded-lg border border-neutral-800/80 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-neutral-200 truncate max-w-[170px]">{evt.room}</p>
                      <p className="text-[10px] text-neutral-500 font-mono">{evt.timestamp}</p>
                    </div>
                    <span className="font-mono text-red-400 font-bold text-[11px] px-1.5 py-0.5 rounded bg-red-950/60 border border-red-900/40">
                      {evt.confidence}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Interactive Camera Troubleshooter & Diagnostic Center Modal */}
      <CameraTroubleshooterModal
        isOpen={showTroubleshooter}
        onClose={() => setShowTroubleshooter(false)}
        onSelectDeviceId={(devId) => {
          setSelectedDeviceId(devId);
          localStorage.setItem('fireguard_preferred_device_id', devId);
          setRetryTrigger(prev => prev + 1);
        }}
        currentDeviceId={selectedDeviceId}
        onRefreshFeed={() => setRetryTrigger(prev => prev + 1)}
      />
    </div>
  );
};
