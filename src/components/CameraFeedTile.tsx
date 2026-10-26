import React, { useRef, useEffect, useState } from 'react';
import { Camera, BoundingBox } from '../types';
import { drawSimulatedScene, drawCctvOverlay } from '../utils/cctvRenderer';
import { detectFireInCanvas } from '../utils/fireDetector';
import { soundAlarm } from '../utils/audioAlarm';
import { Flame, Maximize2, Camera as CameraIcon, AlertTriangle, ShieldCheck, Radio, Wifi } from 'lucide-react';

interface CameraFeedTileProps {
  camera: Camera;
  isMonitoring: boolean;
  isSimulatedFire: boolean;
  onToggleSimulatedFire: (active: boolean) => void;
  onFocusCamera: () => void;
  onTriggerFireAlert: (confidence: number, room: string) => void;
  onSilenceAlarm: () => void;
  confidenceThreshold: number;
  isCompact?: boolean;
}

export const CameraFeedTile: React.FC<CameraFeedTileProps> = ({
  camera,
  isMonitoring,
  isSimulatedFire,
  onToggleSimulatedFire,
  onFocusCamera,
  onTriggerFireAlert,
  onSilenceAlarm,
  confidenceThreshold,
  isCompact = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ipImgRef = useRef<HTMLImageElement | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [ipLoaded, setIpLoaded] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(28);
  const [tileConfidence, setTileConfidence] = useState<number>(0);
  const [tileHasFire, setTileHasFire] = useState<boolean>(false);
  const [bboxes, setBboxes] = useState<BoundingBox[]>([]);

  // Connect device camera if applicable with progressive constraint fallback
  useEffect(() => {
    let isCancelled = false;
    let currentStream: MediaStream | null = null;
    const isRtsp = camera.wifiSubtype === 'rtsp_ip' || (!!camera.url && camera.url.startsWith('rtsp://'));
    const canUseDevice = (camera.type === 'usb' || (camera.useLiveDeviceCamera !== false && !isRtsp)) && isMonitoring;

    if (canUseDevice) {
      const initCamera = async () => {
        const preferredDeviceId = localStorage.getItem('fireguard_preferred_device_id') || undefined;
        const profiles: MediaStreamConstraints[] = [
          {
            video: {
              deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          },
          {
            video: preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : true,
            audio: false
          },
          { video: true, audio: false }
        ];

        let stream: MediaStream | null = null;
        for (const prof of profiles) {
          if (isCancelled) return;
          try {
            stream = await navigator.mediaDevices.getUserMedia(prof);
            if (stream) break;
          } catch {
            // Try next profile
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
        } else {
          setCameraError('Camera busy or unavailable. Showing surveillance scene.');
          setStreamActive(false);
        }
      };

      initCamera();
    } else {
      setStreamActive(false);
    }

    return () => {
      isCancelled = true;
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [camera.type, camera.useLiveDeviceCamera, isMonitoring]);

  // Main rendering loop for this camera feed
  useEffect(() => {
    let animationFrameId: number;
    let frameCount = 0;
    let fpsTimer = performance.now();

    const render = () => {
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

          // 1. Draw Feed Frame (Device Webcam OR Wi-Fi IP Stream OR Safety Scene)
          let drewFrame = false;
          if (streamActive && videoRef.current && videoRef.current.readyState >= 2) {
            try {
              ctx.drawImage(videoRef.current, 0, 0, w, h);
              drewFrame = true;
            } catch {
              // Frame draw fallback
            }
          } else if (ipLoaded && ipImgRef.current && ipImgRef.current.naturalWidth > 0) {
            try {
              ctx.drawImage(ipImgRef.current, 0, 0, w, h);
              drewFrame = true;
            } catch {
              // Image draw fallback
            }
          }

          if (!drewFrame) {
            drawSimulatedScene(ctx, w, h, 'wifi_cam', isSimulatedFire, now);
          }

          // 2. AI YOLOv8 Fire Inference
          if (isMonitoring) {
            const result = detectFireInCanvas(ctx, w, h, confidenceThreshold, isSimulatedFire);
            setTileConfidence(result.confidence);
            setTileHasFire(result.hasFire);
            setBboxes(result.boxes);

            // Draw bounding boxes on this tile (Fire: Red, Human: Cyan, Smoke: Amber)
            for (const box of result.boxes) {
              const isHuman = box.label.toLowerCase().includes('human') || box.label.toLowerCase().includes('person');
              const isSmoke = box.label.toLowerCase().includes('smoke');
              const boxColor = box.color || (isHuman ? '#38bdf8' : isSmoke ? '#f59e0b' : '#ef4444');
              const fillColor = isHuman ? 'rgba(56, 189, 248, 0.20)' : isSmoke ? 'rgba(245, 158, 11, 0.20)' : 'rgba(239, 68, 68, 0.20)';

              ctx.strokeStyle = boxColor;
              ctx.lineWidth = isCompact ? 2 : 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              ctx.fillStyle = fillColor;
              ctx.fillRect(box.x, box.y, box.width, box.height);

              const label = `${box.label}: ${box.confidence}%`;
              ctx.font = `bold ${isCompact ? 10 : 12}px "JetBrains Mono", monospace`;
              const tw = ctx.measureText(label).width;

              ctx.fillStyle = boxColor;
              ctx.fillRect(box.x, Math.max(0, box.y - 20), tw + 10, 20);

              ctx.fillStyle = isHuman ? '#000000' : '#ffffff';
              ctx.fillText(label, box.x + 5, Math.max(14, box.y - 5));
            }

            if (result.hasFire && result.confidence >= confidenceThreshold) {
              onTriggerFireAlert(result.confidence, camera.room);
            }
          } else {
            setTileHasFire(false);
            setTileConfidence(0);
          }

          // 3. CCTV OSD Overlay
          drawCctvOverlay(ctx, w, h, camera, isMonitoring, fps, isCompact);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [camera, isMonitoring, isSimulatedFire, streamActive, confidenceThreshold, onTriggerFireAlert, isCompact, fps]);

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `FireGuard_${camera.room.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
    a.click();
    soundAlarm.playBeep(1200, 0.05);
  };

  const handleToggleFire = () => {
    const nextState = !isSimulatedFire;
    onToggleSimulatedFire(nextState);
    if (nextState) {
      soundAlarm.playBeep(980, 0.1);
      onTriggerFireAlert(95, camera.room);
    } else {
      onSilenceAlarm();
    }
  };

  return (
    <div
      id={`camera-tile-${camera.id}`}
      className={`group relative bg-neutral-900 border rounded-xl overflow-hidden transition-all shadow-md flex flex-col ${
        tileHasFire || isSimulatedFire
          ? 'border-red-600 ring-2 ring-red-500/80 shadow-red-950/70 alarm-pulse'
          : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      {/* Hidden video element for USB / device webcams */}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />

      {/* Hidden image element for IP / RTSP camera stream */}
      {camera.url && (camera.url.startsWith('http') || camera.wifiSubtype === 'rtsp_ip' || camera.url.startsWith('rtsp://')) && (
        <img
          ref={ipImgRef}
          src={
            camera.wifiSubtype === 'rtsp_ip' || camera.url.startsWith('rtsp://')
              ? `/api/rtsp/stream?url=${encodeURIComponent(camera.url)}`
              : camera.url
          }
          crossOrigin="anonymous"
          className="hidden"
          alt="IP Feed"
          onLoad={() => setIpLoaded(true)}
          onError={() => setIpLoaded(false)}
        />
      )}

      {/* Tile Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-950/90 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            tileHasFire
              ? 'bg-red-500 animate-ping'
              : isMonitoring
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-neutral-600'
          }`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-neutral-200 truncate">{camera.name}</span>
              {camera.type === 'wifi_ip' ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800/60 flex items-center gap-1">
                  <Wifi className="w-2.5 h-2.5 text-sky-400" />
                  <span>WI-FI</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                  {camera.type.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[11px] text-sky-400 font-mono truncate">📍 {camera.room}</p>
          </div>
        </div>

        {/* Hazard Badge */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {tileHasFire ? (
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono font-bold text-[10px] animate-pulse flex items-center gap-1">
              <Flame className="w-3 h-3 text-white" />
              <span>FIRE {tileConfidence}%</span>
            </span>
          ) : isMonitoring ? (
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-mono text-[10px] border border-emerald-800/50 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>SECURED</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono text-[10px]">
              STANDBY
            </span>
          )}

          {/* Focus Button */}
          <button
            id={`btn-focus-${camera.id}`}
            onClick={onFocusCamera}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
            title="Focus this camera in Single View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Video Stage */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={isCompact ? 640 : 960}
          height={isCompact ? 360 : 540}
          className="w-full h-full object-contain"
        />

        {/* Standby overlay when monitoring is paused */}
        {!isMonitoring && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-3 text-center">
            <Radio className="w-6 h-6 text-neutral-500 mb-1" />
            <p className="text-xs text-neutral-300 font-medium">Feed Standby</p>
            <p className="text-[10px] text-neutral-500 font-mono">{camera.resolution || '1080p'} • RTSP / USB</p>
          </div>
        )}

        {/* Camera Error Banner */}
        {cameraError && (
          <div className="absolute bottom-2 left-2 right-2 bg-red-950/80 border border-red-800 text-red-200 text-[10px] px-2 py-1 rounded flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
            <span className="truncate">{cameraError}</span>
          </div>
        )}

        {/* Scanning laser effect when monitoring */}
        {isMonitoring && (
          <div className="absolute inset-0 pointer-events-none opacity-15 overflow-hidden">
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-scanline" />
          </div>
        )}
      </div>

      {/* Tile Quick Action Footer */}
      <div className="px-2.5 py-1.5 bg-neutral-950/80 border-t border-neutral-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            id={`btn-fire-test-${camera.id}`}
            onClick={handleToggleFire}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all border ${
              isSimulatedFire
                ? 'bg-red-600 text-white border-red-400 animate-pulse'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700/80'
            }`}
            title={`Trigger test alarm in ${camera.room}`}
          >
            <Flame className={`w-3 h-3 ${isSimulatedFire ? 'text-white' : 'text-red-400'}`} />
            <span>{isSimulatedFire ? 'Reset' : 'Test Alarm'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id={`btn-snapshot-${camera.id}`}
            onClick={handleSnapshot}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded transition-colors"
            title="Save Snapshot"
          >
            <CameraIcon className="w-3.5 h-3.5" />
          </button>
          <button
            id={`btn-expand-${camera.id}`}
            onClick={onFocusCamera}
            className="px-2 py-1 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 text-[11px] rounded border border-neutral-700/80 flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3 text-sky-400" />
            <span>Focus 1x1</span>
          </button>
        </div>
      </div>
    </div>
  );
};
