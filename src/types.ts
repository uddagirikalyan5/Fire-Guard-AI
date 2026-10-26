export type RtspStreamStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'failed'
  | 'reconnecting'
  | 'stopped';

export interface Camera {
  id: string;
  name: string;
  room: string;
  type: 'usb' | 'ip_cctv' | 'wifi_ip';
  url: string;
  status: 'online' | 'offline' | 'warning';
  resolution?: string;
  fps?: number;
  wifiSubtype?: 'phone_ip_webcam' | 'esp32_cam' | 'rtsp_ip' | 'mjpeg_http';
  ipAddress?: string;
  port?: string;
  wifiSignalDbm?: number;
  useLiveDeviceCamera?: boolean;
  rtspStatus?: RtspStreamStatus;
  rtspError?: string;
}

export interface DetectionEvent {
  id: string;
  timestamp: string;
  room: string;
  cameraName: string;
  confidence: number;
  image_path?: string;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  source: string;
  bbox?: [number, number, number, number]; // [x, y, width, height]
  temperatureEstimate?: number;
}

export interface AppSettings {
  confidenceThreshold: number; // e.g. 70%
  alarmVolume: number; // 0 - 100
  alarmSoundEnabled: boolean;
  alertCooldownSeconds: number; // e.g. 10 seconds
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  arduinoEnabled: boolean;
  arduinoComPort: string;
  arduinoBaudRate: number;
  autoRelayTrigger: boolean;
  fpsLimit: number;
  saveScreenshots: boolean;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  fullName: string;
  email: string;
  mobileNumber: string;
  roomName: string;
  password?: string;
  department?: string;
  badgeId?: string;
  createdAt?: string;
}

export type DashboardViewMode = 'single' | 'quad' | 'all';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
  color?: string;
}

export interface SerialLog {
  id: string;
  timestamp: string;
  type: 'TX' | 'RX' | 'INFO' | 'ERR';
  message: string;
}

export type ArduinoConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'command_sent'
  | 'command_failed'
  | 'unsupported'
  | 'permission_blocked';

export interface ArduinoHardwareState {
  status: ArduinoConnectionStatus;
  portInfo: string;
  lastCommandSent: string;
  lastError?: string;
  relayActive: boolean;
  pumpActive: boolean;
  smokeReading?: number;
}
