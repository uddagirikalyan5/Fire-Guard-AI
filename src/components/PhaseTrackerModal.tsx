import React from 'react';
import { X, CheckCircle2, Circle, Layers, Award, Terminal, ArrowRight } from 'lucide-react';

interface PhaseTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToTab?: (tab: string) => void;
}

export const PhaseTrackerModal: React.FC<PhaseTrackerModalProps> = ({ isOpen, onClose, onJumpToTab }) => {
  if (!isOpen) return null;

  const phases = [
    {
      number: 1,
      name: 'Project Setup & Login UI',
      desc: 'Folder structure, requirements.txt, configuration, dark-themed PySide6 login screen with operator authentication.',
      status: 'Completed',
      files: ['requirements.txt', 'config.py', 'ui/login_window.py'],
      targetTab: 'dashboard'
    },
    {
      number: 2,
      name: 'Surveillance Dashboard & Camera Stream',
      desc: 'Live CCTV canvas rendering, OpenCV background capture thread, frame rate controller, room selector.',
      status: 'Completed',
      files: ['camera.py', 'ui/main_window.py'],
      targetTab: 'dashboard'
    },
    {
      number: 3,
      name: 'AI Fire & Smoke Detection',
      desc: 'Ultralytics YOLOv8 inference, red bounding box overlay, confidence percentage calculation, alert debouncing.',
      status: 'Completed',
      files: ['detector.py', 'models/README.txt'],
      targetTab: 'dashboard'
    },
    {
      number: 4,
      name: 'Multi-Channel Alerting & Sound Siren',
      desc: 'Telegram Bot API dispatcher with photo attachment, Web Audio API / Pygame industrial siren synthesizer.',
      status: 'Completed',
      files: ['notifier.py'],
      targetTab: 'settings'
    },
    {
      number: 5,
      name: 'SQLite Database & History Table',
      desc: 'Thread-safe schema initialization for Users, Cameras, Events, and Settings. CSV history report export.',
      status: 'Completed',
      files: ['database.py', 'ui/history_widget.py'],
      targetTab: 'history'
    },
    {
      number: 6,
      name: 'Settings & Parameter Tuning',
      desc: 'Confidence threshold slider, alarm volume, Telegram Bot credentials, camera resolution, persistent storage.',
      status: 'Completed',
      files: ['ui/settings_widget.py'],
      targetTab: 'settings'
    },
    {
      number: 7,
      name: 'Arduino Relay & Serial Actuation',
      desc: 'USB Serial hardware controller for FIRE_ON / FIRE_OFF, relay module pins for water sprinkler & ventilation fan.',
      status: 'Completed',
      files: ['relay.py', 'arduino/fireguard_relay.ino'],
      targetTab: 'relay'
    },
    {
      number: 8,
      name: 'Testing, Polishing & Examiner Documentation',
      desc: 'Real-time performance testing (25-30 FPS), error handling for disconnected feeds, complete README report guide.',
      status: 'Completed',
      files: ['main.py', 'README.md'],
      targetTab: 'dashboard'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950/80 text-amber-400 border border-amber-800/40 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100 font-display">Diploma Project Phase Progress (1 to 8)</h3>
              <p className="text-xs text-neutral-400">Structured development lifecycle checklist for Computer Engineering evaluation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Phase List Body */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
          {phases.map((phase) => (
            <div
              key={phase.number}
              className="p-3.5 bg-neutral-950 rounded-xl border border-neutral-800/80 hover:border-neutral-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/50 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  P{phase.number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-neutral-100">Phase {phase.number}: {phase.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-mono font-semibold border border-emerald-800/40">
                      ✓ Verified & Complete
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{phase.desc}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {phase.files.map(f => (
                      <span key={f} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {onJumpToTab && (
                <button
                  onClick={() => {
                    onJumpToTab(phase.targetTab);
                    onClose();
                  }}
                  className="self-end sm:self-center px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-colors flex items-center gap-1 shrink-0"
                >
                  <span>Test Phase</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span>All 8 development phases fully implemented and tested.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-semibold"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
};
