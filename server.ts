import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { rtspService } from './src/server/rtspService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // CORS middleware for API routes
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // --- RTSP API ENDPOINTS ---

  // Health and FFmpeg Check
  app.get('/api/rtsp/health', (_req, res) => {
    const info = rtspService.getFfmpegInfo();
    res.json({
      ok: true,
      ffmpegInstalled: info.available,
      version: info.version,
      installGuide: info.installGuide,
      serverTime: new Date().toISOString()
    });
  });

  // Test RTSP Connection Probe
  app.post('/api/rtsp/test', async (req, res) => {
    const { rtspUrl } = req.body;
    if (!rtspUrl) {
      return res.status(400).json({ success: false, message: 'rtspUrl is required' });
    }

    const result = await rtspService.testRtspConnection(rtspUrl);
    res.json(result);
  });

  // Start / Register Stream
  app.post('/api/rtsp/start', (req, res) => {
    const { rtspUrl, room, name } = req.body;
    if (!rtspUrl) {
      return res.status(400).json({ success: false, message: 'rtspUrl is required' });
    }

    const session = rtspService.getOrCreateSession(rtspUrl, { room, name });
    const encodedUrl = encodeURIComponent(rtspUrl);

    res.json({
      success: true,
      streamId: session.info.streamId,
      streamUrl: `/api/rtsp/stream?url=${encodedUrl}`,
      frameUrl: `/api/rtsp/frame?url=${encodedUrl}`,
      status: session.info.status,
      info: session.info
    });
  });

  // Live MJPEG Stream Endpoint
  app.get('/api/rtsp/stream', (req, res) => {
    const url = req.query.url as string;
    const room = (req.query.room as string) || 'Safety Zone';
    const name = (req.query.name as string) || 'Mobile RTSP Camera';

    if (!url) {
      return res.status(400).send('Missing url query parameter');
    }

    rtspService.subscribeToStream(url, res, req, { room, name });
  });

  // Single Frame Snapshot Endpoint
  app.get('/api/rtsp/frame', (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).send('Missing url query parameter');
    }

    const frame = rtspService.getLatestFrame(url);
    if (frame) {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': frame.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      });
      res.end(frame);
    } else {
      res.status(404).json({ error: 'No frame buffered yet. Stream may be connecting.' });
    }
  });

  // Stream Session Status
  app.get('/api/rtsp/status', (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'Missing url query parameter' });
    }

    const info = rtspService.getSessionInfo(url);
    if (info) {
      res.json(info);
    } else {
      res.json({
        streamId: rtspService.getStreamId(url),
        status: 'idle',
        fps: 0,
        clientsCount: 0
      });
    }
  });

  // Recent RTSP Logs
  app.get('/api/rtsp/logs', (_req, res) => {
    res.json({ logs: rtspService.getLogs() });
  });

  // Stop Stream Endpoint
  app.post('/api/rtsp/stop', (req, res) => {
    const { streamId } = req.body;
    if (streamId) {
      rtspService.stopSession(streamId);
    }
    res.json({ success: true });
  });

  // --- FRONTEND INTEGRATION (Vite Middleware in Dev, Static in Prod) ---
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🔥 [FireGuard AI Server] Full-stack engine active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FireGuard Server] Failed to start:', err);
  process.exit(1);
});
