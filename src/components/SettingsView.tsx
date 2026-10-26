import React, { useState } from 'react';
import {
  Save, RotateCcw, Volume2, ShieldCheck, Send, Cpu,
  Sliders, BellRing, CheckCircle2, AlertCircle, Camera as CameraIcon
} from 'lucide-react';
import { AppSettings } from '../types';
import { testTelegramConnection } from '../utils/telegram';
import { soundAlarm } from '../utils/audioAlarm';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onResetDefaults: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetDefaults
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    soundAlarm.playBeep(980, 0.1);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestSiren = () => {
    soundAlarm.playAlarm(formData.alarmVolume);
    setTimeout(() => {
      soundAlarm.stopAlarm();
    }, 1500);
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTestResult(null);
    const res = await testTelegramConnection(formData.telegramBotToken, formData.telegramChatId);
    setTestResult(res);
    setIsTestingTelegram(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-red-500" />
            <span>System Configuration & Thresholds</span>
          </h2>
          <p className="text-xs text-neutral-400">Configure AI model sensitivity, alarm triggers, Telegram credentials, and hardware relays</p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-lg font-medium animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settings Saved Successfully</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Section 1: AI Detection Parameters */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2 pb-2 border-b border-neutral-800">
            <ShieldCheck className="w-4 h-4 text-red-400" />
            <span>AI YOLOv8 Fire & Smoke Inference Engine</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Confidence Threshold Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-200">
                  Confidence Threshold (%)
                </label>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-950 text-red-400 border border-neutral-800">
                  {formData.confidenceThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="95"
                step="5"
                value={formData.confidenceThreshold}
                onChange={(e) => handleChange('confidenceThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Detections below this percentage are filtered out to prevent false alarms from ambient lighting.
              </p>
            </div>

            {/* Alert Cooldown */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-200">
                  Alert Cooldown Interval (Seconds)
                </label>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-950 text-sky-400 border border-neutral-800">
                  {formData.alertCooldownSeconds}s
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="60"
                step="1"
                value={formData.alertCooldownSeconds}
                onChange={(e) => handleChange('alertCooldownSeconds', parseInt(e.target.value))}
                className="w-full h-2 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Prevents repetitive Telegram notifications and continuous database writes during ongoing fire incidents.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Audio Siren & Alarm Settings */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2 pb-2 border-b border-neutral-800">
            <BellRing className="w-4 h-4 text-amber-400" />
            <span>Industrial Sound Alarm Siren</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Alarm Volume */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-200">
                  Siren Volume
                </label>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-950 text-amber-400 border border-neutral-800">
                  {formData.alarmVolume}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={formData.alarmVolume}
                onChange={(e) => handleChange('alarmVolume', parseInt(e.target.value))}
                className="w-full h-2 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Test Alarm Sound */}
            <div className="flex items-center justify-start md:justify-end gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.alarmSoundEnabled}
                  onChange={(e) => handleChange('alarmSoundEnabled', e.target.checked)}
                  className="w-4 h-4 rounded bg-neutral-950 border-neutral-700 text-red-600"
                />
                <span>Enable Audio Siren</span>
              </label>

              <button
                type="button"
                onClick={handleTestSiren}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Siren (1.5s)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Telegram Bot API Dispatcher */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              <span>Telegram Bot Remote Alerts</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 font-mono border border-sky-800/40">
              BotFather API
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Telegram Bot Token
              </label>
              <input
                type="text"
                value={formData.telegramBotToken}
                onChange={(e) => handleChange('telegramBotToken', e.target.value)}
                placeholder="e.g. 7123456789:AAFxAbcDefGhiJklMnoPqrStu"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <p className="text-[10px] text-neutral-500 mt-1">Leave empty to run in offline/simulation mode.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Target Chat ID / Channel ID
              </label>
              <input
                type="text"
                value={formData.telegramChatId}
                onChange={(e) => handleChange('telegramChatId', e.target.value)}
                placeholder="e.g. 987654321 or -10012345678"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <p className="text-[10px] text-neutral-500 mt-1">Your Telegram user ID or group channel ID.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={isTestingTelegram}
              className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-sky-300 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTestingTelegram ? 'Sending Test Ping...' : 'Send Test Ping to Telegram'}</span>
            </button>

            {testResult && (
              <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                testResult.ok
                  ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                  : 'bg-red-950 border border-red-800 text-red-300'
              }`}>
                {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{testResult.msg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Hardware / Arduino USB Serial */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2 pb-2 border-b border-neutral-800">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Arduino Hardware Relay & COM Port Settings</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Serial COM Port</label>
              <input
                type="text"
                value={formData.arduinoComPort}
                onChange={(e) => handleChange('arduinoComPort', e.target.value)}
                placeholder="COM3 or /dev/ttyUSB0"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Baud Rate</label>
              <select
                value={formData.arduinoBaudRate}
                onChange={(e) => handleChange('arduinoBaudRate', parseInt(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value={9600}>9600 bps (Standard Arduino)</option>
                <option value={19200}>19200 bps</option>
                <option value={115200}>115200 bps (High Speed ESP32)</option>
              </select>
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoRelayTrigger}
                  onChange={(e) => handleChange('autoRelayTrigger', e.target.checked)}
                  className="w-4 h-4 rounded bg-neutral-950 border-neutral-700 text-emerald-600"
                />
                <span>Auto-Trigger FIRE_ON</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onResetDefaults}
            className="px-4 py-2.5 bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-medium rounded-xl border border-neutral-800 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            id="btn-save-settings-main"
            type="submit"
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-red-950/40 border border-red-500/30 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save System Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
