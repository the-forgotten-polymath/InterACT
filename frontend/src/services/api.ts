import {
  Session,
  CreateSessionRequest,
  CreateSessionResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  EndSessionResponse
} from '../types/session';

const PROD_API_BASE = 'https://interact-backend-25ys.onrender.com/api/v1';

export function getApiBase(): string {
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) return envApi;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
    if (!isLocal) {
      return PROD_API_BASE;
    }
  }

  return '/api/v1';
}

export function getWebSocketUrl(sessionId: string, participantId: string): string {
  const envWs = import.meta.env.VITE_WS_URL;
  if (envWs) {
    const base = envWs.endsWith('/') ? envWs.slice(0, -1) : envWs;
    return `${base}/sessions/${sessionId}?participant_id=${participantId}`;
  }

  const apiBase = getApiBase();
  if (apiBase.startsWith('http')) {
    const wsBase = apiBase.replace(/^http/, 'ws');
    return `${wsBase}/ws/sessions/${sessionId}?participant_id=${participantId}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/v1/ws/sessions/${sessionId}?participant_id=${participantId}`;
}

export class InterACTApi {
  static async checkHealth(): Promise<{ status: string; service: string }> {
    const res = await fetch(`${getApiBase()}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  }

  static async createSession(req: CreateSessionRequest = {}): Promise<CreateSessionResponse> {
    const res = await fetch(`${getApiBase()}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create session (${res.status})`);
    }
    return res.json();
  }

  static async getSession(sessionId: string): Promise<Session> {
    const res = await fetch(`${getApiBase()}/sessions/${sessionId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Session not found (${res.status})`);
    }
    return res.json();
  }

  static async joinSession(
    sessionId: string,
    req: JoinSessionRequest
  ): Promise<JoinSessionResponse> {
    const res = await fetch(`${getApiBase()}/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to join session (${res.status})`);
    }
    return res.json();
  }

  static async endSession(
    sessionId: string,
    endedBy?: string,
    reason?: string
  ): Promise<EndSessionResponse> {
    const res = await fetch(`${getApiBase()}/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ended_by: endedBy, reason })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to end session (${res.status})`);
    }
    return res.json();
  }

  static async reconstructSpeech(req: {
    raw_transcript: string;
    language?: string;
    session_id?: string;
  }): Promise<{
    raw_transcript: string;
    reconstructed_text: string;
    confidence_score: number;
    disfluencies_detected: string[];
    preserved_entities: string[];
    needs_clarification: boolean;
    clarification_prompt?: string;
    processing_time_ms: number;
  }> {
    const res = await fetch(`${getApiBase()}/fluency/reconstruct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Speech reconstruction failed (${res.status})`);
    }
    return res.json();
  }
}
