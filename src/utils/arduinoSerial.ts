/**
 * FireGuard AI - Arduino Web Serial Hardware Interface
 * Communicates directly with physical Arduino Uno / Nano / ESP32 over USB Serial
 * via the native Chromium Web Serial API (navigator.serial).
 *
 * Transmits real hardware commands:
 * - FIRE_ON\n  -> Energizes Pin 7 Relay (LOW) -> Turns 12V Water Extinguisher Pump ON
 * - FIRE_OFF\n -> De-energizes Pin 7 Relay (HIGH) -> Turns 12V Water Pump OFF
 * - PUMP_ON\n  -> Manual Pump Override ON
 * - PUMP_OFF\n -> Manual Pump Override OFF
 * - STATUS\n   -> Requests live hardware telemetry
 */

import { ArduinoConnectionStatus } from '../types';

export interface SerialCommandResult {
  success: boolean;
  command: string;
  error?: string;
  timestamp: string;
}

export type LogCallback = (type: 'TX' | 'RX' | 'INFO' | 'ERR', message: string) => void;
export type StatusCallback = (
  status: ArduinoConnectionStatus,
  error?: string,
  portInfo?: string
) => void;
export type DataCallback = (rawLine: string) => void;

class ArduinoSerialController {
  private port: any = null;
  private reader: any = null;
  private writer: any = null;
  private keepReading: boolean = false;
  private status: ArduinoConnectionStatus = 'disconnected';
  private portName: string = '';
  private lastError: string = '';
  private lastCommand: string = '';

  private logListeners: Set<LogCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private dataListeners: Set<DataCallback> = new Set();

  constructor() {
    // Listen for USB device disconnect events from OS
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      (navigator as any).serial.addEventListener('disconnect', (event: any) => {
        if (this.port && event.port === this.port) {
          this.log('ERR', 'Arduino USB hardware disconnected unexpectedly from host.');
          this.handleDisconnectCleanup('Arduino USB disconnected');
        }
      });
    }
  }

  /**
   * Subscribe to serial log messages
   */
  public onLog(cb: LogCallback): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  /**
   * Subscribe to connection status changes
   */
  public onStatusChange(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    cb(this.status, this.lastError, this.portName);
    return () => this.statusListeners.delete(cb);
  }

  /**
   * Subscribe to incoming parsed lines from Arduino
   */
  public onData(cb: DataCallback): () => void {
    this.dataListeners.add(cb);
    return () => this.dataListeners.delete(cb);
  }

  private log(type: 'TX' | 'RX' | 'INFO' | 'ERR', message: string) {
    this.logListeners.forEach(cb => cb(type, message));
  }

  private setStatus(status: ArduinoConnectionStatus, error: string = '', portInfo: string = '') {
    this.status = status;
    this.lastError = error;
    if (portInfo) this.portName = portInfo;
    this.statusListeners.forEach(cb => cb(status, error, this.portName));
  }

  public getStatus(): ArduinoConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'connected' || this.status === 'command_sent';
  }

  public getPortName(): string {
    return this.portName || 'Unknown Port';
  }

  /**
   * Check if browser environment supports Web Serial API
   */
  public checkBrowserSupport(): { supported: boolean; reason?: string } {
    if (typeof window === 'undefined') {
      return { supported: false, reason: 'Window object not available' };
    }
    if (!('serial' in navigator)) {
      return {
        supported: false,
        reason:
          'Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera on Windows, macOS, or Linux.'
      };
    }
    return { supported: true };
  }

  /**
   * Auto-connect to an already authorized Arduino port if available
   */
  public async tryAutoConnect(baudRate: number = 9600): Promise<boolean> {
    const support = this.checkBrowserSupport();
    if (!support.supported) return false;

    try {
      const ports = await (navigator as any).serial.getPorts();
      if (ports && ports.length > 0) {
        this.log('INFO', `Found ${ports.length} previously authorized USB serial device(s). Reconnecting...`);
        return await this.openPort(ports[0], baudRate, 'Auto-reconnected');
      }
    } catch (e: any) {
      console.warn('[ArduinoSerial] Auto-connect check failed:', e);
    }
    return false;
  }

  /**
   * Requests user permission to select and connect to Arduino USB COM port
   */
  public async requestAndConnect(baudRate: number = 9600): Promise<boolean> {
    const support = this.checkBrowserSupport();
    if (!support.supported) {
      const err = support.reason || 'Web Serial API unsupported';
      this.log('ERR', err);
      this.setStatus('unsupported', err);
      return false;
    }

    this.setStatus('connecting', '', 'Selecting COM Port...');
    this.log('INFO', 'Opening Web Serial device selector. Select your Arduino Uno / USB Serial port...');

    try {
      // Request serial port picker from user
      const port = await (navigator as any).serial.requestPort({
        // Arduino Uno R3 USB VID: 0x2341 (Arduino SA), 0x2A03 (Arduino SRL), 0x1A86 (CH340 clone), 0x10C4 (CP2102)
        filters: [
          { usbVendorId: 0x2341 }, // Official Arduino Uno/Mega
          { usbVendorId: 0x2a03 }, // Arduino SRL
          { usbVendorId: 0x1a86 }, // QinHeng Electronics CH340 (common Uno clone)
          { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
          { usbVendorId: 0x0403 }, // FTDI
        ]
      }).catch(async (filterErr: any) => {
        // If filtered request fails, allow user to pick any serial port
        return await (navigator as any).serial.requestPort();
      });

      if (!port) {
        this.setStatus('disconnected', 'No port selected');
        this.log('INFO', 'Arduino port selection cancelled.');
        return false;
      }

      return await this.openPort(port, baudRate);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (err?.name === 'NotFoundError') {
        this.setStatus('disconnected', 'Port selection cancelled');
        this.log('INFO', 'Serial port selection was cancelled.');
        return false;
      }

      if (err?.name === 'SecurityError') {
        const securityMsg =
          'Browser Security Policy Blocked: Web Serial is restricted inside this iframe sandbox. Open the app in a new standalone tab or popout window in Chrome/Edge to allow USB serial access.';
        this.setStatus('permission_blocked', securityMsg);
        this.log('ERR', securityMsg);
        return false;
      }

      this.setStatus('command_failed', errMsg);
      this.log('ERR', `Failed to open Arduino port: ${errMsg}`);
      return false;
    }
  }

  /**
   * Opens an identified SerialPort, sets up reader and writer streams
   */
  private async openPort(port: any, baudRate: number, contextLabel: string = 'Connected'): Promise<boolean> {
    try {
      this.port = port;

      // Extract USB hardware identifiers if available
      const info = port.getInfo ? port.getInfo() : {};
      const vid = info.usbVendorId ? `VID:0x${info.usbVendorId.toString(16).toUpperCase()}` : '';
      const pid = info.usbProductId ? `PID:0x${info.usbProductId.toString(16).toUpperCase()}` : '';
      const hwLabel = [vid, pid].filter(Boolean).join(' ') || 'USB Serial';
      this.portName = `Arduino (${hwLabel} @ ${baudRate} baud)`;

      this.log('INFO', `Opening serial port at ${baudRate} baud...`);
      await port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
        bufferSize: 1024
      });

      this.setStatus('connected', '', this.portName);
      this.log('INFO', `[ARDUINO CONNECTED] Physical USB Serial link active on ${this.portName}. Ready for relay commands.`);

      // Start asynchronous read loop
      this.startReadingLoop();

      // Query initial status from Arduino
      setTimeout(() => {
        this.sendCommand('STATUS');
      }, 1200);

      return true;
    } catch (openErr: any) {
      const errStr = openErr?.message || String(openErr);
      if (errStr.includes('already open') || openErr?.name === 'InvalidStateError') {
        this.setStatus('connected', '', this.portName || 'Arduino Port');
        this.log('INFO', 'Port was already open. Reusing serial connection.');
        this.startReadingLoop();
        return true;
      }

      const helpfulMsg = errStr.includes('Failed to open')
        ? `${errStr}. Check if Arduino IDE Serial Monitor or Python is holding the port. Close them and retry.`
        : errStr;

      this.setStatus('command_failed', helpfulMsg);
      this.log('ERR', `Error opening port: ${helpfulMsg}`);
      return false;
    }
  }

  /**
   * Background reader loop to decode incoming lines from Arduino
   */
  private async startReadingLoop() {
    if (!this.port || !this.port.readable) return;
    this.keepReading = true;

    try {
      const textDecoder = new TextDecoder();
      this.reader = this.port.readable.getReader();
      let buffer = '';

      while (this.keepReading && this.port && this.port.readable) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          const chunk = textDecoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.length > 0) {
              this.handleIncomingLine(cleanLine);
            }
          }
        }
      }
    } catch (readErr: any) {
      if (this.keepReading) {
        console.warn('[ArduinoSerial] Read loop error:', readErr);
        this.log('ERR', `Serial read error: ${readErr?.message || String(readErr)}`);
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {}
        this.reader = null;
      }
    }
  }

  /**
   * Process a clean line received from Arduino
   */
  private handleIncomingLine(line: string) {
    this.log('RX', line);
    this.dataListeners.forEach(cb => cb(line));

    // Handle ACK & Status responses
    if (line.includes('ALERT:FIRE_ACTIVATED') || line.includes('PUMP=ON') || line.includes('ACK:PUMP_ON')) {
      this.setStatus('connected', '', this.portName);
    } else if (line.includes('ACK:FIRE_DEACTIVATED') || line.includes('PUMP=OFF') || line.includes('ACK:PUMP_OFF')) {
      this.setStatus('connected', '', this.portName);
    }
  }

  /**
   * Transmits a hardware command string to Arduino over USB Serial
   * @param command Command string such as 'FIRE_ON', 'FIRE_OFF', 'PUMP_ON', 'PUMP_OFF', 'STATUS'
   */
  public async sendCommand(command: string): Promise<SerialCommandResult> {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    const cleanCmd = command.trim().toUpperCase();
    this.lastCommand = cleanCmd;

    // Check if hardware connection is active
    if (!this.port || !this.port.writable) {
      const err = `Cannot send '${cleanCmd}': Arduino is disconnected. Please click 'Connect Arduino (USB)' to pair your board.`;
      this.log('ERR', err);
      this.setStatus('command_failed', err);
      return {
        success: false,
        command: cleanCmd,
        error: err,
        timestamp
      };
    }

    try {
      const encoder = new TextEncoder();
      const packet = encoder.encode(`${cleanCmd}\n`);

      this.writer = this.port.writable.getWriter();
      await this.writer.write(packet);
      this.writer.releaseLock();
      this.writer = null;

      // Log success and update status
      this.log('TX', `${cleanCmd}\\n`);
      this.setStatus('command_sent', '', this.portName);

      // Brief transition back to 'connected' after command sent feedback
      setTimeout(() => {
        if (this.status === 'command_sent') {
          this.setStatus('connected', '', this.portName);
        }
      }, 1500);

      return {
        success: true,
        command: cleanCmd,
        timestamp
      };
    } catch (writeErr: any) {
      if (this.writer) {
        try {
          this.writer.releaseLock();
        } catch {}
        this.writer = null;
      }
      const errStr = writeErr?.message || String(writeErr);
      const fullErr = `Failed to send '${cleanCmd}' to Arduino: ${errStr}`;
      this.log('ERR', fullErr);
      this.setStatus('command_failed', fullErr);

      return {
        success: false,
        command: cleanCmd,
        error: fullErr,
        timestamp
      };
    }
  }

  /**
   * Gracefully close connection to Arduino
   */
  public async disconnect(): Promise<void> {
    this.keepReading = false;
    this.log('INFO', 'Disconnecting Arduino USB Serial...');

    // Send safety FIRE_OFF before terminating connection if writable
    if (this.port && this.port.writable) {
      try {
        const encoder = new TextEncoder();
        const writer = this.port.writable.getWriter();
        await writer.write(encoder.encode('FIRE_OFF\n'));
        writer.releaseLock();
      } catch {}
    }

    await this.handleDisconnectCleanup('Disconnected by user');
  }

  private async handleDisconnectCleanup(reason: string) {
    this.keepReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      try {
        this.reader.releaseLock();
      } catch {}
      this.reader = null;
    }

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {}
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }

    this.setStatus('disconnected', reason);
    this.log('INFO', `Arduino connection closed: ${reason}`);
  }
}

// Global Singleton Instance
export const arduinoSerial = new ArduinoSerialController();
