/**
 * FireGuard AI - RTSP-to-Browser Streaming & AI Vision Service
 *
 * Architecture:
 * Mobile Camera (RTSP)
 *      ↓ (RTSP over TCP)
 * Backend / FFmpeg Child Process
 *      ↓ (MJPEG image2pipe stream)
 * Express HTTP Stream Endpoint (/api/rtsp/stream)
 *      ↓
 * Browser Dashboard <img> / Canvas Element
 *      ↓
 * AI Fire Detection Pipeline (YOLOv8 Canvas Heuristics)
 */

import { spawn, ChildProcess } from 'child_process';

export type RtspConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'failed'
  | 'reconnecting'
  | 'stopped';

export interface RtspLogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface RtspSessionInfo {
  streamId: string;
  rtspUrl: string;
  room: string;
  name: string;
  status: RtspConnectionStatus;
  lastError?: string;
  lastFrameTime: number;
  fps: number;
  clientsCount: number;
  width?: number;
  height?: number;
  codec?: string;
  reconnectAttempts: number;
}

interface ActiveSession {
  info: RtspSessionInfo;
  process: ChildProcess | null;
  latestFrame: Buffer | null;
  subscribers: Set<any>; // Express response objects
  killTimer: NodeJS.Timeout | null;
  fpsCounter: number;
  lastFpsCheck: number;
  buffer: Buffer;
}

class RtspService {
  private sessions = new Map<string, ActiveSession>();
  private logs: RtspLogItem[] = [];
  private ffmpegAvailable: boolean | null = null;
  private ffmpegPath: string = 'ffmpeg';
  private ffmpegVersion: string = '';

  constructor() {
    this.checkFfmpeg();
  }

  public addLog(level: 'info' | 'warn' | 'error', message: string) {
    const timeStr = new Date().toLocaleTimeString([], { hour12: false });
    const logItem: RtspLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeStr,
      level,
      message
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 150) {
      this.logs.pop();
    }
    console.log(`[RTSP ${level.toUpperCase()}] ${message}`);
  }

  public getLogs(): RtspLogItem[] {
    return this.logs;
  }

  /**
   * Detect whether FFmpeg binary is available on system PATH
   */
  public async checkFfmpeg(): Promise<{ available: boolean; version?: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        const proc = spawn(this.ffmpegPath, ['-version']);
        let output = '';

        proc.stdout.on('data', (d) => {
          output += d.toString();
        });

        proc.on('error', (err) => {
          this.ffmpegAvailable = false;
          const msg = `FFmpeg not detected in PATH: ${err.message}. On Windows: run 'winget install Gyan.FFmpeg' or download from gyan.dev and add to PATH.`;
          this.addLog('warn', msg);
          resolve({ available: false, error: msg });
        });

        proc.on('close', (code) => {
          if (code === 0) {
            this.ffmpegAvailable = true;
            const match = output.match(/ffmpeg version ([^\s]+)/i);
            this.ffmpegVersion = match ? match[1] : 'unknown';
            this.addLog('info', `FFmpeg binary verified: version ${this.ffmpegVersion}`);
            resolve({ available: true, version: this.ffmpegVersion });
          } else {
            this.ffmpegAvailable = false;
            resolve({ available: false, error: `FFmpeg returned exit code ${code}` });
          }
        });
      } catch (err: any) {
        this.ffmpegAvailable = false;
        resolve({ available: false, error: String(err) });
      }
    });
  }

  public isFfmpegInstalled(): boolean {
    return this.ffmpegAvailable === true;
  }

  public getFfmpegInfo() {
    return {
      available: this.ffmpegAvailable,
      version: this.ffmpegVersion,
      installGuide:
        'To install FFmpeg on Windows, open PowerShell as Administrator and run: winget install Gyan.FFmpeg'
    };
  }

  /**
   * Compute deterministic stream ID from RTSP URL
   */
  public getStreamId(rtspUrl: string): string {
    let clean = rtspUrl.trim().toLowerCase();
    // Mask password in ID computation
    clean = clean.replace(/:\/\/[^@]+@/, '://');
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash << 5) - hash + clean.charCodeAt(i);
      hash |= 0;
    }
    return `stream-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Validate and test an RTSP URL connection before adding
   */
  public async testRtspConnection(
    rtspUrl: string,
    timeoutMs: number = 6000
  ): Promise<{
    success: boolean;
    message: string;
    streamInfo?: string;
    latencyMs?: number;
    error?: string;
  }> {
    if (!rtspUrl || !rtspUrl.toLowerCase().startsWith('rtsp://')) {
      return {
        success: false,
        message: 'Invalid protocol. URL must begin with rtsp://',
        error: 'URL does not start with rtsp://'
      };
    }

    if (this.ffmpegAvailable === false) {
      return {
        success: false,
        message: 'FFmpeg is not installed on this host.',
        error:
          'FFmpeg missing. Install FFmpeg on Windows: `winget install Gyan.FFmpeg` or Linux: `sudo apt install ffmpeg`'
      };
    }

    this.addLog('info', `[RTSP] Testing connection to ${this.maskUrl(rtspUrl)}...`);
    const startTime = Date.now();

    return new Promise((resolve) => {
      let isSettled = false;
      let stderrOutput = '';

      const args = [
        '-rtsp_transport',
        'tcp',
        '-stimeout',
        `${timeoutMs * 1000}`,
        '-i',
        rtspUrl,
        '-t',
        '1',
        '-f',
        'null',
        '-'
      ];

      const proc = spawn(this.ffmpegPath, args);

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            proc.kill('SIGKILL');
          } catch {}
          const elapsed = Date.now() - startTime;
          this.addLog('warn', `[RTSP] Connection timeout after ${elapsed}ms: ${this.maskUrl(rtspUrl)}`);
          resolve({
            success: false,
            message: `Connection timed out after ${timeoutMs}ms. Verify IP address, port 554, and Wi-Fi connection.`,
            error: 'Connection timed out'
          });
        }
      }, timeoutMs);

      proc.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      proc.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          this.addLog('error', `[RTSP] Test process error: ${err.message}`);
          resolve({
            success: false,
            message: `Failed to launch FFmpeg: ${err.message}`,
            error: err.message
          });
        }
      });

      proc.on('close', (code) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);
        const elapsed = Date.now() - startTime;

        // Check if stream information was discovered in stderr
        const hasStream =
          stderrOutput.includes('Output #0') ||
          stderrOutput.includes('Stream #0:0') ||
          stderrOutput.includes('Video:');

        if (hasStream || code === 0) {
          // Extract resolution & codec
          const resMatch = stderrOutput.match(/(\d{3,4}x\d{3,4})/);
          const codecMatch = stderrOutput.match(/Video:\s*([a-zA-Z0-9_-]+)/);
          const resolution = resMatch ? resMatch[1] : 'Detected';
          const codec = codecMatch ? codecMatch[1] : 'H.264';
          const info = `${resolution} (${codec}) • ${elapsed}ms latency`;

          this.addLog('info', `[RTSP] Connected! Stream detected: ${info}`);
          resolve({
            success: true,
            message: `RTSP stream verified successfully: ${info}`,
            streamInfo: info,
            latencyMs: elapsed
          });
        } else {
          // Diagnose error reason from FFmpeg stderr
          let humanReason = 'Failed to connect to RTSP camera.';
          if (stderrOutput.includes('401') || stderrOutput.includes('Unauthorized')) {
            humanReason = 'Authentication failed (401 Unauthorized). Check RTSP username and password.';
          } else if (stderrOutput.includes('Connection refused')) {
            humanReason = 'Connection refused. Check camera IP address and port (default 554).';
          } else if (stderrOutput.includes('No route to host') || stderrOutput.includes('timed out')) {
            humanReason = 'Camera unreachable. Ensure your computer and phone/camera are on the SAME Wi-Fi network.';
          } else if (stderrOutput.includes('Invalid data')) {
            humanReason = 'Invalid stream data format from camera.';
          }

          this.addLog('error', `[RTSP] Connection failed: ${humanReason}`);
          resolve({
            success: false,
            message: humanReason,
            error: stderrOutput.slice(-300).trim()
          });
        }
      });
    });
  }

  /**
   * Get or start a shared RTSP streaming session
   */
  public getOrCreateSession(
    rtspUrl: string,
    options: { room?: string; name?: string } = {}
  ): ActiveSession {
    const streamId = this.getStreamId(rtspUrl);
    let session = this.sessions.get(streamId);

    if (session) {
      if (options.room) session.info.room = options.room;
      if (options.name) session.info.name = options.name;
      if (session.killTimer) {
        clearTimeout(session.killTimer);
        session.killTimer = null;
      }
      return session;
    }

    // Initialize new session
    session = {
      info: {
        streamId,
        rtspUrl,
        room: options.room || 'Safety Zone',
        name: options.name || 'Mobile RTSP Camera',
        status: 'connecting',
        lastFrameTime: 0,
        fps: 0,
        clientsCount: 0,
        reconnectAttempts: 0
      },
      process: null,
      latestFrame: null,
      subscribers: new Set(),
      killTimer: null,
      fpsCounter: 0,
      lastFpsCheck: Date.now(),
      buffer: Buffer.alloc(0)
    };

    this.sessions.set(streamId, session);
    this.startFfmpegProcess(session);
    return session;
  }

  /**
   * Launch FFmpeg process to receive RTSP and transcode to MJPEG stream
   */
  private startFfmpegProcess(session: ActiveSession) {
    if (session.process) {
      try {
        session.process.kill('SIGTERM');
      } catch {}
      session.process = null;
    }

    session.info.status = 'connecting';
    this.addLog('info', `[RTSP] Connecting... (${this.maskUrl(session.info.rtspUrl)})`);

    const args = [
      '-rtsp_transport',
      'tcp',
      '-stimeout',
      '5000000',
      '-reconnect',
      '1',
      '-reconnect_at_eof',
      '1',
      '-reconnect_streamed',
      '1',
      '-reconnect_delay_max',
      '3',
      '-i',
      session.info.rtspUrl,
      '-fflags',
      'nobuffer',
      '-flags',
      'low_delay',
      '-strict',
      'experimental',
      '-an',
      '-vf',
      'scale=min(1280\\,iw):-2',
      '-q:v',
      '3',
      '-r',
      '25',
      '-f',
      'image2pipe',
      '-vcodec',
      'mjpeg',
      '-'
    ];

    try {
      const proc = spawn(this.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      session.process = proc;

      let hasReportedConnected = false;
      let hasReportedStream = false;

      // Stdout emits continuous JPEG chunks
      proc.stdout?.on('data', (chunk: Buffer) => {
        session.buffer = Buffer.concat([session.buffer, chunk]);

        // Parse individual JPEG frames by delimiter SOI (0xFF, 0xD8) and EOI (0xFF, 0xD9)
        while (session.buffer.length > 0) {
          const startIndex = session.buffer.indexOf(Buffer.from([0xff, 0xd8]));
          if (startIndex === -1) {
            session.buffer = Buffer.alloc(0);
            break;
          }

          const endIndex = session.buffer.indexOf(Buffer.from([0xff, 0xd9]), startIndex + 2);
          if (endIndex === -1) {
            // Awaiting more frame chunks
            if (startIndex > 0) {
              session.buffer = session.buffer.slice(startIndex);
            }
            break;
          }

          const jpegFrame = session.buffer.slice(startIndex, endIndex + 2);
          session.buffer = session.buffer.slice(endIndex + 2);

          // Update session frame state
          session.latestFrame = jpegFrame;
          session.info.lastFrameTime = Date.now();
          session.fpsCounter++;

          if (!hasReportedStream) {
            hasReportedStream = true;
            session.info.status = 'streaming';
            this.addLog('info', `[RTSP] Stream detected. Browser stream started.`);
          }

          // Broadcast frame to all connected HTTP clients
          this.broadcastFrame(session, jpegFrame);
        }

        // FPS calculation every second
        const now = Date.now();
        if (now - session.lastFpsCheck >= 1000) {
          session.info.fps = session.fpsCounter;
          session.fpsCounter = 0;
          session.lastFpsCheck = now;
        }
      });

      // Stderr contains diagnostic and connection logs
      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();

        if (!hasReportedConnected && (text.includes('Stream #0') || text.includes('Output #0'))) {
          hasReportedConnected = true;
          session.info.status = 'connected';
          this.addLog('info', `[RTSP] Connected`);
          const resMatch = text.match(/(\d{3,4}x\d{3,4})/);
          if (resMatch) {
            const parts = resMatch[1].split('x');
            session.info.width = parseInt(parts[0], 10);
            session.info.height = parseInt(parts[1], 10);
          }
        }

        if (text.includes('Connection refused') || text.includes('401 Unauthorized') || text.includes('timed out')) {
          session.info.lastError = text.slice(0, 180).trim();
          this.addLog('warn', `[RTSP] Stderr notice: ${session.info.lastError}`);
        }
      });

      proc.on('error', (err) => {
        session.info.status = 'failed';
        session.info.lastError = err.message;
        this.addLog('error', `[RTSP] Process error: ${err.message}`);
      });

      proc.on('close', (code) => {
        this.addLog('warn', `[RTSP] Connection lost (exit code ${code})`);
        session.process = null;

        // Auto-reconnect if there are active subscribers
        if (session.subscribers.size > 0 && session.info.status !== 'stopped') {
          session.info.status = 'reconnecting';
          session.info.reconnectAttempts++;
          this.addLog('info', `[RTSP] Reconnecting... (attempt ${session.info.reconnectAttempts})`);

          setTimeout(() => {
            if (session.subscribers.size > 0 && session.info.status !== 'stopped') {
              this.startFfmpegProcess(session);
            }
          }, Math.min(10000, 1500 * session.info.reconnectAttempts));
        } else {
          session.info.status = 'stopped';
        }
      });
    } catch (e: any) {
      session.info.status = 'failed';
      session.info.lastError = e.message;
      this.addLog('error', `[RTSP] Failed to spawn FFmpeg: ${e.message}`);
    }
  }

  /**
   * Broadcasts a single JPEG frame to all connected HTTP clients
   */
  private broadcastFrame(session: ActiveSession, frame: Buffer) {
    if (session.subscribers.size === 0) return;

    const header = Buffer.from(
      `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`
    );
    const footer = Buffer.from('\r\n');

    for (const res of session.subscribers) {
      try {
        res.write(header);
        res.write(frame);
        res.write(footer);
      } catch {
        session.subscribers.delete(res);
      }
    }
  }

  /**
   * Attach an Express response stream to receive the live multipart MJPEG stream
   */
  public subscribeToStream(
    rtspUrl: string,
    res: any,
    req: any,
    options: { room?: string; name?: string } = {}
  ) {
    const session = this.getOrCreateSession(rtspUrl, options);

    // HTTP Multipart stream headers
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    session.subscribers.add(res);
    session.info.clientsCount = session.subscribers.size;

    // Send latest frame immediately if cached
    if (session.latestFrame) {
      try {
        res.write(
          Buffer.from(
            `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${session.latestFrame.length}\r\n\r\n`
          )
        );
        res.write(session.latestFrame);
        res.write(Buffer.from('\r\n'));
      } catch {}
    }

    // Clean up when client disconnects
    req.on('close', () => {
      session.subscribers.delete(res);
      session.info.clientsCount = session.subscribers.size;

      // If no clients remain, schedule process cleanup after 45 seconds of idle
      if (session.subscribers.size === 0) {
        if (!session.killTimer) {
          session.killTimer = setTimeout(() => {
            if (session.subscribers.size === 0) {
              this.stopSession(session.info.streamId);
            }
          }, 45000);
        }
      }
    });
  }

  /**
   * Get latest single JPEG frame snapshot
   */
  public getLatestFrame(rtspUrl: string): Buffer | null {
    const streamId = this.getStreamId(rtspUrl);
    const session = this.sessions.get(streamId);
    return session?.latestFrame || null;
  }

  /**
   * Get live session status info
   */
  public getSessionInfo(rtspUrl: string): RtspSessionInfo | null {
    const streamId = this.getStreamId(rtspUrl);
    const session = this.sessions.get(streamId);
    return session ? { ...session.info } : null;
  }

  /**
   * Stop an active stream session
   */
  public stopSession(streamId: string) {
    const session = this.sessions.get(streamId);
    if (!session) return;

    session.info.status = 'stopped';
    if (session.killTimer) {
      clearTimeout(session.killTimer);
      session.killTimer = null;
    }

    if (session.process) {
      try {
        session.process.kill('SIGTERM');
      } catch {}
      session.process = null;
    }

    this.sessions.delete(streamId);
    this.addLog('info', `[RTSP] Stream session stopped: ${streamId}`);
  }

  private maskUrl(url: string): string {
    return url.replace(/:\/\/[^@]+@/, '://***:***@');
  }
}

export const rtspService = new RtspService();
