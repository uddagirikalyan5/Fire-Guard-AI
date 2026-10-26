import { Camera, DetectionEvent, AppSettings } from '../types';

export const DEFAULT_CAMERAS: Camera[] = [
  {
    id: 'cam-1',
    name: 'Primary Camera Feed',
    room: 'Main Safety Zone',
    type: 'usb',
    url: '0',
    status: 'online',
    resolution: '1280x720',
    fps: 30,
    useLiveDeviceCamera: true
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  confidenceThreshold: 75,
  alarmVolume: 80,
  alarmSoundEnabled: true,
  alertCooldownSeconds: 10,
  telegramEnabled: true,
  telegramBotToken: '',
  telegramChatId: '',
  arduinoEnabled: true,
  arduinoComPort: 'COM3 (Arduino Uno)',
  arduinoBaudRate: 9600,
  autoRelayTrigger: true,
  fpsLimit: 30,
  saveScreenshots: true
};

export const INITIAL_DETECTION_EVENTS: DetectionEvent[] = [];
