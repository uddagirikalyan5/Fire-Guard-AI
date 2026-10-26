import React from 'react';
import { Flame, ShieldAlert, VolumeX, CheckCircle, Cpu, Droplets, Wind } from 'lucide-react';

interface EmergencyAlertModalProps {
  isOpen: boolean;
  room: string;
  confidence: number;
  hazardType?: 'Fire' | 'Smoke' | 'Fire & Smoke';
  onSilence: () => void;
  onAcknowledge: () => void;
  onTriggerRelay: () => void;
  relayActive: boolean;
  operatorMobile?: string;
  operatorEmail?: string;
  operatorName?: string;
}

export const EmergencyAlertModal: React.FC<EmergencyAlertModalProps> = ({
  isOpen,
  room,
  confidence,
  hazardType = 'Fire',
  onSilence,
  onAcknowledge,
  onTriggerRelay,
  relayActive,
  operatorMobile,
  operatorEmail,
  operatorName
}) => {
  if (!isOpen) return null;

  const isSmoke = hazardType === 'Smoke';

  return (
    <div className="fixed inset-0 z-50 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className={`bg-neutral-950 border-2 ${isSmoke ? 'border-amber-500' : 'border-red-600'} rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl alarm-pulse text-center p-6 sm:p-8 space-y-5`}>
        {/* Animated Siren Graphic */}
        <div className="flex justify-center">
          <div className={`w-20 h-20 rounded-full ${isSmoke ? 'bg-amber-600' : 'bg-red-600'} text-white flex items-center justify-center shadow-lg animate-bounce`}>
            {isSmoke ? <Wind className="w-11 h-11" /> : <Flame className="w-12 h-12" />}
          </div>
        </div>

        {/* Text Header */}
        <div className="space-y-1">
          <h2 className={`text-2xl sm:text-3xl font-display font-black tracking-wider ${isSmoke ? 'text-amber-400' : 'text-red-500'}`}>
            {isSmoke ? '💨 DENSE SMOKE DETECTED' : hazardType === 'Fire & Smoke' ? '🚨 FIRE & SMOKE DETECTED' : '🚨 CRITICAL FIRE DETECTED'}
          </h2>
          <p className="text-xs font-mono uppercase tracking-widest text-neutral-400">
            Water Extinguisher Pump Triggered Automatically
          </p>
        </div>

        {/* Hazard Information Box */}
        <div className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl space-y-2 text-left">
          <div className="flex items-center justify-between text-xs border-b border-neutral-800/80 pb-2">
            <span className="text-neutral-400">Hazard Location:</span>
            <span className="font-bold text-white font-mono text-sm">{room}</span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-neutral-800/80 pb-2">
            <span className="text-neutral-400">Hazard Type:</span>
            <span className={`font-bold font-mono text-xs uppercase px-2 py-0.5 rounded ${isSmoke ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
              {hazardType}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-neutral-800/80 pb-2">
            <span className="text-neutral-400">Water Extinguisher Pump:</span>
            <span className="text-cyan-400 font-bold font-mono text-xs flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 animate-pulse" />
              {relayActive ? 'PUMP ACTIVE (DISPENSING WATER)' : 'PUMP TRIGGERED (PIN 7)'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-neutral-800/80 pb-2">
            <span className="text-neutral-400">AI Confidence:</span>
            <span className={`font-bold font-mono text-sm ${isSmoke ? 'text-amber-400' : 'text-red-400'}`}>{confidence}%</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">Telegram Notification:</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Dispatched
            </span>
          </div>

          {operatorMobile && (
            <div className="flex items-center justify-between text-xs border-t border-neutral-800/80 pt-2">
              <span className="text-neutral-400">Telegram Contact:</span>
              <span className="text-sky-400 font-mono font-medium">{operatorMobile} {operatorName ? `(${operatorName})` : ''}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            id="btn-silence-emergency-modal"
            onClick={onSilence}
            className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold text-xs rounded-xl border border-neutral-700 transition-colors flex items-center justify-center gap-2"
          >
            <VolumeX className="w-4 h-4 text-red-400" />
            <span>Silence Audio Siren</span>
          </button>

          <button
            id="btn-trigger-relay-emergency-modal"
            onClick={onTriggerRelay}
            className={`py-3 px-4 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 border ${
              relayActive
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-950/60'
                : 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-lg'
            }`}
          >
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span>{relayActive ? 'Water Pump Active (ON)' : 'Force Start Water Pump'}</span>
          </button>
        </div>

        {/* Dismiss / Acknowledge */}
        <div className="pt-2">
          <button
            id="btn-acknowledge-emergency-modal"
            onClick={onAcknowledge}
            className="w-full py-2.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            Acknowledge and Dismiss Window
          </button>
        </div>
      </div>
    </div>
  );
};
