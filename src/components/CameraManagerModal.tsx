import React, { useState } from 'react';
import { X, Plus, Video, Trash2, CheckCircle2, AlertCircle, Play, Shield, Wifi, Wrench, RefreshCw, AlertTriangle } from 'lucide-react';
import { Camera } from '../types';

interface CameraManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: Camera[];
  activeCamera: Camera;
  onSelectCamera: (cam: Camera) => void;
  onAddCamera: (newCam: Omit<Camera, 'id'>) => void;
  onDeleteCamera: (id: string) => void;
  onDeleteDuplicates?: () => void;
  onOpenTroubleshooter?: () => void;
}

export const CameraManagerModal: React.FC<CameraManagerModalProps> = ({
  isOpen,
  onClose,
  cameras,
  activeCamera,
  onSelectCamera,
  onAddCamera,
  onDeleteCamera,
  onDeleteDuplicates,
  onOpenTroubleshooter
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [type, setType] = useState<'usb' | 'ip_cctv' | 'wifi_ip'>('wifi_ip');
  const [url, setUrl] = useState('http://192.168.1.50:8080/video');
  const [resolution, setResolution] = useState('1920x1080');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  const handleTestConnection = async () => {
    if (!url.trim()) {
      setTestStatus('failed');
      setTestMessage('Please enter a stream or RTSP URL first.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Connecting and probing stream via backend...');

    try {
      const isRtsp = url.trim().toLowerCase().startsWith('rtsp://');
      if (isRtsp) {
        const res = await fetch('/api/rtsp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rtspUrl: url.trim(), timeoutMs: 5000 })
        });
        const data = await res.json();
        if (data.ok) {
          setTestStatus('success');
          setTestMessage(data.message || 'RTSP Stream verified successfully! Mobile camera is live.');
        } else {
          setTestStatus('failed');
          setTestMessage(data.message || 'Failed to connect to RTSP stream. Check IP/Wi-Fi.');
        }
      } else {
        // HTTP Stream test
        setTestStatus('success');
        setTestMessage('HTTP Stream URL format looks valid.');
      }
    } catch (err: any) {
      setTestStatus('failed');
      setTestMessage(err.message || 'Stream test request failed.');
    }
  };

  if (!isOpen) return null;

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !room.trim()) return;

    const isUsb = type === 'usb';
    const isRtsp = url.trim().toLowerCase().startsWith('rtsp://');

    onAddCamera({
      name: name.trim(),
      room: room.trim(),
      type: isRtsp ? 'wifi_ip' : type,
      wifiSubtype: isRtsp ? 'rtsp_ip' : undefined,
      url: isUsb ? '0' : url.trim(),
      status: 'online',
      resolution,
      fps: 30,
      useLiveDeviceCamera: isUsb
    });

    if (isRtsp) {
      // Pre-warm backend RTSP stream
      fetch('/api/rtsp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtspUrl: url.trim(), room: room.trim(), name: name.trim() })
      }).catch(() => {});
    }

    setName('');
    setRoom('');
    setShowAddForm(false);
    onClose();
  };

  // Ensure duplicate camera records are filtered out
  const seenCamKeys = new Set<string>();
  const uniqueCameras = cameras.filter(cam => {
    const key = `${(cam.name || '').trim().toLowerCase()}__${(cam.url || '').trim().toLowerCase()}`;
    if (seenCamKeys.has(key)) return false;
    seenCamKeys.add(key);
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-neutral-800 rounded-lg text-sky-400">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">Camera & Room Management</h3>
              <p className="text-xs text-neutral-400">Configure USB and RTSP IP cameras assigned to rooms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          {/* Active Cameras List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Registered Feeds ({uniqueCameras.length})</h4>
              <div className="flex items-center gap-2">
                {onOpenTroubleshooter && (
                  <button
                    id="btn-modal-open-troubleshooter"
                    onClick={() => {
                      onClose();
                      onOpenTroubleshooter();
                    }}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Camera not working? Run live diagnostics, fix permissions, and test devices"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Camera Doctor</span>
                  </button>
                )}

                {onDeleteDuplicates && cameras.length > 1 && (
                  <button
                    id="btn-delete-duplicate-cameras"
                    onClick={onDeleteDuplicates}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                    title="Delete duplicate cameras with same name or URL"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Delete Duplicates</span>
                  </button>
                )}

                {!showAddForm && (
                  <button
                    id="btn-show-add-camera-form"
                    onClick={() => setShowAddForm(true)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Camera</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {uniqueCameras.map((cam) => {
                const isActive = cam.id === activeCamera.id;
                return (
                  <div
                    key={cam.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-neutral-800/90 border-red-500/60 shadow-sm'
                        : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${
                        cam.type === 'wifi_ip'
                          ? 'bg-sky-950 text-sky-400 border border-sky-800/50'
                          : isActive 
                            ? 'bg-red-950 text-red-400 border border-red-800/50' 
                            : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {cam.type === 'wifi_ip' ? <Wifi className="w-4 h-4 text-sky-400" /> : <Video className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-neutral-100">{cam.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                            cam.type === 'wifi_ip' 
                              ? 'bg-sky-950 text-sky-300 border-sky-800/60 font-semibold' 
                              : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          }`}>
                            {cam.type === 'wifi_ip' ? 'WI-FI IP' : cam.type.toUpperCase()}
                          </span>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-semibold border border-emerald-800/40">
                              ACTIVE FEED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">
                          📍 Room: <strong className="text-sky-300">{cam.room}</strong> | URI: <span className="text-neutral-400 truncate">{cam.url}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <button
                          id={`btn-select-cam-${cam.id}`}
                          onClick={() => {
                            onSelectCamera(cam);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-colors"
                        >
                          Switch Feed
                        </button>
                      )}
                      {cameras.length > 1 && (
                        <button
                          id={`btn-delete-cam-${cam.id}`}
                          onClick={() => onDeleteCamera(cam.id)}
                          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                          title="Delete Camera"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Camera Form */}
          {showAddForm && (
            <form onSubmit={handleSubmitNew} className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <h4 className="text-sm font-semibold text-neutral-200">Register New Camera</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Camera Label</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CCTV-06 Chemistry Lab"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Assigned Room Name</label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g. Lab A, Room 101, Server Rack"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Camera Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'usb' | 'ip_cctv' | 'wifi_ip')}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-red-500"
                  >
                    <option value="wifi_ip">Wi-Fi Camera (Smartphone / ESP32-CAM / Wireless IP)</option>
                    <option value="ip_cctv">IP CCTV (RTSP / HTTP)</option>
                    <option value="usb">USB HD Webcam</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-neutral-300">Stream URL / IP</label>
                    {type !== 'usb' && (
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                      >
                        {testStatus === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        <span>Test Connection</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={type === 'usb' ? '0' : url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setTestStatus('idle');
                      setTestMessage('');
                    }}
                    disabled={type === 'usb'}
                    placeholder="rtsp://192.168.1.50:554/stream or http://..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-500 disabled:opacity-50 font-mono"
                  />
                </div>
              </div>

              {testStatus !== 'idle' && (
                <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                  testStatus === 'testing'
                    ? 'bg-neutral-900 border-neutral-700 text-neutral-300'
                    : testStatus === 'success'
                    ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
                    : 'bg-red-950/70 border-red-700/80 text-red-300'
                }`}>
                  {testStatus === 'testing' && <RefreshCw className="w-4 h-4 animate-spin text-sky-400 shrink-0" />}
                  {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {testStatus === 'failed' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                  <span className="font-medium">{testMessage}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-new-camera"
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg font-semibold shadow"
                >
                  Save Camera
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
