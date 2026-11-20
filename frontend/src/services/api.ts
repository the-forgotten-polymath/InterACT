import {
  Session,
  CreateSessionRequest,
  CreateSessionResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  EndSessionResponse
} from '../types/session';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api/v1';

export function getWebSocketUrl(sessionId: string, participantId: string): string {
  const envWs = (import.meta as any).env?.VITE_WS_URL;
  if (envWs) {
    const base = envWs.endsWith('/') ? envWs.slice(0, -1) : envWs;
    return `${base}/sessions/${sessionId}?participant_id=${participantId}`;
  }

  const envApi = (import.meta as any).env?.VITE_API_URL;
  if (envApi && envApi.startsWith('http')) {
    const wsBase = envApi.replace(/^http/, 'ws');
    return `${wsBase}/ws/sessions/${sessionId}?participant_id=${participantId}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/v1/ws/sessions/${sessionId}?participant_id=${participantId}`;
}

export class InterACTApi {
  static async checkHealth(): Promise<{ status: string; service: string }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  }

  static async createSession(req: CreateSessionRequest = {}): Promise<CreateSessionResponse> {
    const res = await fetch(`${API_BASE}/sessions`, {
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
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
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
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/join`, {
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
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/end`, {
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
    const res = await fetch(`${API_BASE}/fluency/reconstruct`, {
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
