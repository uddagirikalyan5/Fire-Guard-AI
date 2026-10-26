import React, { useState, useEffect } from 'react';
import { ShieldAlert, Video, Bell, HardDrive, Volume2, VolumeX, Code, CheckSquare, LogOut, Cpu, User as UserIcon, Zap, Wrench } from 'lucide-react';
import { Camera, AppSettings, User, ArduinoConnectionStatus } from '../types';

interface NavbarProps {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeCamera: Camera;
  isMonitoring: boolean;
  hasFire: boolean;
  currentConfidence: number;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onOpenPythonStudio: () => void;
  onOpenPhaseTracker: () => void;
  onOpenTroubleshooter?: () => void;
  onLogout: () => void;
  arduinoConnected: boolean;
  arduinoStatus?: ArduinoConnectionStatus;
  onConnectArduino?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  activeCamera,
  isMonitoring,
  hasFire,
  currentConfidence,
  settings,
  setSettings,
  onOpenPythonStudio,
  onOpenPhaseTracker,
  onOpenTroubleshooter,
  onLogout,
  arduinoConnected,
  arduinoStatus = 'disconnected',
  onConnectArduino
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }) +
        '  |  ' +
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Surveillance Dashboard', icon: Video },
    { id: 'circuit', label: 'IoT Circuit Diagram', icon: Zap },
    { id: 'relay', label: 'Relay Controls & Serial', icon: Cpu },
    { id: 'history', label: 'Detection History', icon: Bell },
    { id: 'settings', label: 'System Settings', icon: HardDrive },
  ];

  return (
    <header className="bg-neutral-950 border-b border-neutral-800/80 sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shadow-md transition-colors ${
              hasFire 
                ? 'bg-red-600 alarm-pulse shadow-red-600/50' 
                : isMonitoring 
                  ? 'bg-emerald-600 shadow-emerald-900/30' 
                  : 'bg-neutral-800'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-wider text-white">FIREGUARD AI</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 font-mono border border-red-800/40">
                  DIPLOMA CE
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-medium">Autonomous Vision Fire Surveillance</p>
            </div>
          </div>

          {/* Status Capsule */}
          <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-neutral-800 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                hasFire 
                  ? 'bg-red-500 animate-ping' 
                  : isMonitoring 
                    ? 'bg-emerald-400 animate-pulse' 
                    : 'bg-neutral-500'
              }`} />
              <span className="font-medium text-neutral-300">
                {hasFire 
                  ? `🚨 FIRE ALERT (${currentConfidence}%)` 
                  : isMonitoring 
                    ? 'ACTIVE MONITORING' 
                    : 'STANDBY'}
              </span>
            </div>
            <span className="text-neutral-600">•</span>

            {/* Arduino Hardware Connection Status */}
            <div className="flex items-center gap-1 font-mono">
              {arduinoStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Arduino Connected
                </span>
              ) : arduinoStatus === 'command_sent' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 text-[11px] font-semibold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Command Sent
                </span>
              ) : arduinoStatus === 'command_failed' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-700/60 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Command Failed
                </span>
              ) : (
                <button
                  type="button"
                  id="btn-navbar-connect-arduino"
                  onClick={onConnectArduino}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-amber-300 hover:text-amber-200 border border-amber-800/60 text-[11px] font-semibold transition-colors"
                  title="Click to connect physical Arduino Uno via USB"
                >
                  <Cpu className="w-3 h-3 text-amber-400" />
                  <span>Arduino Disconnected (Click to Connect)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-neutral-900/90 p-1 rounded-lg border border-neutral-800 text-xs font-medium overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  active
                    ? 'bg-neutral-800 text-white shadow-sm font-semibold border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Tools & User Info */}
        <div className="flex items-center gap-2">
          {/* Audio Mute Toggle */}
          <button
            id="btn-toggle-sound"
            onClick={() => setSettings(prev => ({ ...prev, alarmSoundEnabled: !prev.alarmSoundEnabled }))}
            className={`p-2 rounded-lg border transition-colors ${
              settings.alarmSoundEnabled
                ? 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                : 'bg-red-950/40 border-red-800/50 text-red-400'
            }`}
            title={settings.alarmSoundEnabled ? 'Alarm Sound: Enabled' : 'Alarm Sound: Muted'}
          >
            {settings.alarmSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Phase Progress Button */}
          <button
            id="btn-phase-tracker"
            onClick={onOpenPhaseTracker}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-amber-400 text-xs rounded-lg border border-amber-900/40 transition-colors"
            title="Diploma Project Phase Approval Tracker"
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline font-mono">Phases (1-8)</span>
          </button>

          {/* Camera Troubleshooter / Doctor Button */}
          {onOpenTroubleshooter && (
            <button
              id="btn-nav-troubleshoot-camera"
              onClick={onOpenTroubleshooter}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-amber-300 text-xs font-semibold rounded-lg border border-amber-800/40 transition-colors"
              title="Camera not working? Run live diagnostics, fix permissions, and test devices"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Camera Fix</span>
            </button>
          )}

          {/* Python Codebase / ZIP Export */}
          <button
            id="btn-view-python-code"
            onClick={onOpenPythonStudio}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-200 text-xs font-semibold rounded-lg border border-red-700/60 transition-colors shadow-sm"
            title="Inspect complete Python 3.11 + PySide6 source code and download ZIP"
          >
            <Code className="w-3.5 h-3.5 text-red-400" />
            <span>Python Source & ZIP</span>
          </button>

          {/* Clock */}
          <div className="hidden xl:block font-mono text-xs text-neutral-400 px-2 py-1 bg-neutral-900/80 rounded border border-neutral-800">
            {timeStr}
          </div>

          {/* Operator Profile Badge & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
            <div
              className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs"
              title={`Logged in: ${user?.fullName || user?.username}\nRole: ${user?.role === 'admin' ? 'Admin' : 'User'}\nRoom: ${user?.roomName || 'N/A'}\nMobile (Telegram): ${user?.mobileNumber || 'N/A'}\nEmail: ${user?.email || 'N/A'}`}
            >
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-[10px] ${
                user?.role === 'admin'
                  ? 'bg-red-950 text-red-300 border-red-800/80'
                  : 'bg-sky-950 text-sky-300 border-sky-800/80'
              }`}>
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : (user?.role === 'admin' ? 'A' : 'U')}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-neutral-200 text-[11px] truncate max-w-[100px]">
                    {user?.fullName || user?.username || 'Operator'}
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                    user?.role === 'admin'
                      ? 'bg-red-950 text-red-400 border border-red-800/60'
                      : 'bg-sky-950 text-sky-400 border border-sky-800/60'
                  }`}>
                    {user?.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 truncate max-w-[140px]">
                  {user?.roomName ? `📍 ${user.roomName}` : 'Central Facility'}
                </p>
              </div>
            </div>

            <button
              id="btn-logout"
              onClick={onLogout}
              className="flex items-center gap-1 p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-900 rounded-lg transition-colors text-xs"
              title={`Signed in as: ${user?.username || 'admin'} (${user?.role?.toUpperCase() || 'USER'}) • Click to Sign Out`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
