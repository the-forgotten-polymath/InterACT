import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';

function signLiveKitToken(apiKey: string, apiSecret: string, room: string, identity: string, name?: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: identity,
    name: name || identity,
    nbf: now - 5,
    exp: now + 3600 * 6, // 6 hours
    video: {
      room: room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${encHeader}.${encPayload}`)
    .digest('base64url');

  return `${encHeader}.${encPayload}.${signature}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'livekit-token-server',
        configureServer(server) {
          server.middlewares.use('/api/token', (req, res) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const room = url.searchParams.get('room') || 'DEFAULT';
            const identity = url.searchParams.get('identity') || `user_${Math.random().toString(36).substring(2, 8)}`;
            const name = url.searchParams.get('name') || identity;

            const apiKey = env.LIVEKIT_API_KEY || process.env.LIVEKIT_API_KEY || '';
            const apiSecret = env.LIVEKIT_API_SECRET || process.env.LIVEKIT_API_SECRET || '';
            const livekitUrl = env.LIVEKIT_URL || process.env.LIVEKIT_URL || '';

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (!apiKey || !apiSecret) {
              res.statusCode = 400;
              res.end(JSON.stringify({
                error: 'LIVEKIT_API_KEY or LIVEKIT_API_SECRET not configured in .env',
                configured: false
              }));
              return;
            }

            try {
              const token = signLiveKitToken(apiKey, apiSecret, room, identity, name);
              res.statusCode = 200;
              res.end(JSON.stringify({
                token,
                livekitUrl,
                room,
                identity,
                name
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });

          server.middlewares.use('/api/health', (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'ok', service: 'checkin-livekit-service' }));
          });
        }
      }
    ],
    server: {
      port: 5174,
      host: '0.0.0.0'
    }
  };
});
