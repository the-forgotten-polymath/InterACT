import type { LiveKitConfig } from './types';

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

/**
 * Sign a LiveKit JWT token right inside the browser using Web Crypto API.
 * This allows connecting with LiveKit Cloud credentials without needing a backend server restart.
 */
export async function signTokenInBrowser(
  apiKey: string,
  apiSecret: string,
  room: string,
  identity: string,
  name?: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: identity,
    name: name || identity,
    nbf: now - 5,
    exp: now + 3600 * 6, // 6 hours validity
    video: {
      room: room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encHeader}.${encPayload}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(dataToSign)
  );

  const signature = bufferToBase64Url(signatureBuffer);
  return `${dataToSign}.${signature}`;
}

export interface TokenResult {
  token: string;
  livekitUrl: string;
  room: string;
  identity: string;
  name: string;
}

/**
 * Obtain a token either:
 * 1. From UI config (if token or apiKey/apiSecret was provided in Settings)
 * 2. Or by calling the `/api/token` endpoint (which is served by Vite dev server or backend)
 */
export async function getLiveKitToken(
  room: string,
  identity: string,
  name: string,
  customConfig?: Partial<LiveKitConfig>
): Promise<TokenResult> {
  // Option 1: Direct token override
  if (customConfig?.token && customConfig.livekitUrl) {
    return {
      token: customConfig.token,
      livekitUrl: customConfig.livekitUrl,
      room,
      identity,
      name
    };
  }

  // Option 2: Browser signing if keys are provided in customConfig
  if (customConfig?.apiKey && customConfig?.apiSecret && customConfig?.livekitUrl) {
    const token = await signTokenInBrowser(
      customConfig.apiKey,
      customConfig.apiSecret,
      room,
      identity,
      name
    );
    return {
      token,
      livekitUrl: customConfig.livekitUrl,
      room,
      identity,
      name
    };
  }

  // Option 3: Call /api/token backend endpoint
  const query = new URLSearchParams({
    room,
    identity,
    name
  });

  const response = await fetch(`/api/token?${query.toString()}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Server responded with ${response.status}`);
  }

  const result = await response.json();
  return {
    token: result.token,
    livekitUrl: result.livekitUrl || customConfig?.livekitUrl || '',
    room,
    identity,
    name
  };
}
