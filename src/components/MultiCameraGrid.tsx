import React, { useState } from 'react';
import { Camera, AppSettings } from '../types';
import { CameraFeedTile } from './CameraFeedTile';
import {
  LayoutGrid, Grid2X2, Play, Square, Flame, Camera as CameraIcon,
  Plus, Radio, RefreshCw, VolumeX, AlertTriangle, ShieldCheck, Wifi
} from 'lucide-react';
import { soundAlarm } from '../utils/audioAlarm';

interface MultiCameraGridProps {
  cameras: Camera[];
  isMonitoring: boolean;
  setIsMonitoring: (val: boolean) => void;
  onFocusCamera: (cam: Camera) => void;
  onOpenAddCamera: () => void;
  onOpenAddWifiCamera?: () => void;
  settings: AppSettings;
  onTriggerFireAlert: (confidence: number, room: string) => void;
  onSilenceAlarm: () => void;
  hasFire: boolean;
  currentConfidence: number;
  activeFireRoom?: string;
  onSwitchToSingleView: (cam?: Camera) => void;
}

export const MultiCameraGrid: React.FC<MultiCameraGridProps> = ({
  cameras,
  isMonitoring,
  setIsMonitoring,
  onFocusCamera,
  onOpenAddCamera,
  onOpenAddWifiCamera,
  settings,
  onTriggerFireAlert,
  onSilenceAlarm,
  hasFire,
  currentConfidence,
  activeFireRoom,
  onSwitchToSingleView
}) => {
  const [gridMode, setGridMode] = useState<'quad' | 'all'>('all');
  const [simulatedFireMap, setSimulatedFireMap] = useState<Record<string, boolean>>({});

  const displayedCameras = gridMode === 'quad' ? cameras.slice(0, 4) : cameras;

  const handleToggleSimulatedFire = (camId: string, active: boolean) => {
    setSimulatedFireMap(prev => ({ ...prev, [camId]: active }));
  };

  const handleTriggerRandomFireDrill = () => {
    if (cameras.length === 0) return;
    // Pick a random camera to trigger fire drill
    const randomIndex = Math.floor(Math.random() * cameras.length);
    const targetCam = cameras[randomIndex];
    setSimulatedFireMap({ [targetCam.id]: true });
    setIsMonitoring(true);
    soundAlarm.playBeep(980, 0.1);
    onTriggerFireAlert(96, targetCam.room);
  };

  const handleResetAllFires = () => {
    setSimulatedFireMap({});
    onSilenceAlarm();
  };

  const activeHazardCount = Object.values(simulatedFireMap).filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Top Banner Alert if Fire Active across any camera */}
      {hasFire && (
        <div className="p-3.5 bg-red-950/95 border-2 border-red-600 rounded-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 alarm-pulse shadow-xl shadow-red-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-bold animate-bounce shrink-0">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-base sm:text-lg tracking-wide text-red-100">
                  CRITICAL MULTI-CHANNEL HAZARD ALERT
                </span>
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded font-mono font-bold">
                  {currentConfidence}% CONFIDENCE
                </span>
              </div>
              <p className="text-xs text-red-200 mt-0.5">
                Target Room: <strong className="text-white underline">{activeFireRoom || 'Surveillance Sector'}</strong> | Hardware Relay Engaged | Telegram Notified
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              id="btn-silence-multi-alarm"
              onClick={handleResetAllFires}
              className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg border border-neutral-700 transition-colors flex items-center gap-1.5"
            >
              <VolumeX className="w-4 h-4 text-red-400" />
              <span>Silence All Alarms</span>
            </button>
          </div>
        </div>
      )}

      {/* Control & Matrix Toolbar */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Stream Mode & Counts */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isMonitoring ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
            <h2 className="text-sm font-bold text-neutral-100 font-display">
              Multi-Camera Surveillance Matrix
            </h2>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400 pl-3 border-l border-neutral-800">
            <span className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-300">
              {displayedCameras.length} Live Feeds
            </span>
            {activeHazardCount > 0 ? (
              <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800/80 text-red-300 animate-pulse">
                🚨 {activeHazardCount} Fire Hazard{activeHazardCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
                ✓ All Sectors Clear
              </span>
            )}
          </div>
        </div>

        {/* Right: Layout Switcher & Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Grid Layout Selector */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              id="btn-grid-all"
              onClick={() => setGridMode('all')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                gridMode === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="View All Connected Cameras"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All ({cameras.length})</span>
            </button>
            <button
              id="btn-grid-quad"
              onClick={() => setGridMode('quad')}
              className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                gridMode === 'quad'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="2x2 Quad Matrix View"
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              <span>Quad (2x2)</span>
            </button>
          </div>

          {/* Master Start/Stop */}
          {isMonitoring ? (
            <button
              id="btn-multi-stop-monitoring"
              onClick={() => {
                setIsMonitoring(false);
                handleResetAllFires();
              }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-sm border border-red-500/40"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Pause All</span>
            </button>
          ) : (
            <button
              id="btn-multi-start-monitoring"
              onClick={() => {
                setIsMonitoring(true);
                soundAlarm.playBeep(880, 0.08);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-sm border border-emerald-500/40"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Monitor All</span>
            </button>
          )}

          {/* Manual Test Alarm Button */}
          <button
            id="btn-multi-fire-drill"
            onClick={activeHazardCount > 0 ? handleResetAllFires : handleTriggerRandomFireDrill}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 border transition-all ${
              activeHazardCount > 0
                ? 'bg-red-600 text-white border-red-400 animate-pulse'
                : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700'
            }`}
            title="Trigger test alarm to verify multi-camera alerting"
          >
            <Flame className={`w-3.5 h-3.5 ${activeHazardCount > 0 ? 'text-white' : 'text-red-400'}`} />
            <span>{activeHazardCount > 0 ? 'Reset Alarm' : 'Test Multi-Alert'}</span>
          </button>

          {/* Add Wi-Fi Camera Button */}
          {onOpenAddWifiCamera && (
            <button
              id="btn-multi-add-wifi-cam"
              onClick={onOpenAddWifiCamera}
              className="px-2.5 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl shadow-sm text-xs font-semibold flex items-center gap-1.5 border border-sky-400/40"
              title="Add Smartphone or ESP32-CAM Wi-Fi Camera"
            >
              <Wifi className="w-3.5 h-3.5 text-sky-200" />
              <span className="hidden sm:inline">+ Wi-Fi Cam</span>
            </button>
          )}

          {/* Add Camera Button */}
          <button
            id="btn-multi-add-cam"
            onClick={onOpenAddCamera}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-xl border border-neutral-700 text-xs"
            title="Register New CCTV/IP Camera"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Cameras */}
      <div className={`grid gap-4 ${
        gridMode === 'quad'
          ? 'grid-cols-1 md:grid-cols-2'
          : displayedCameras.length <= 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      }`}>
        {displayedCameras.map((camera) => (
          <CameraFeedTile
            key={camera.id}
            camera={camera}
            isMonitoring={isMonitoring}
            isSimulatedFire={!!simulatedFireMap[camera.id]}
            onToggleSimulatedFire={(active) => handleToggleSimulatedFire(camera.id, active)}
            onFocusCamera={() => onSwitchToSingleView(camera)}
            onTriggerFireAlert={(conf, room) => onTriggerFireAlert(conf, room)}
            onSilenceAlarm={onSilenceAlarm}
            confidenceThreshold={settings.confidenceThreshold}
            isCompact={displayedCameras.length > 2}
          />
        ))}
      </div>
    </div>
  );
};
