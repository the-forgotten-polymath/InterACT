export type SessionStatus = 'active' | 'ended' | 'expired';

export type ParticipantRole = 'customer' | 'agent' | 'kiosk';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface BusinessContext {
  type: 'order' | 'banking' | 'hospital' | 'general' | string;
  id?: string;
  data: Record<string, any>;
}

export interface Participant {
  participant_id: string;
  role: ParticipantRole;
  joined_at: number;
  preferences?: Record<string, any>;
  connection_status?: ConnectionStatus;
}

export interface Session {
  session_id: string;
  organization_id: string;
  status: SessionStatus;
  business_context: BusinessContext;
  config: Record<string, any>;
  created_at: number;
  expires_at: number;
  participants: Record<string, Participant>;
  ended_at?: number;
  ended_by?: string;
  end_reason?: string;
}

export interface CreateSessionRequest {
  organization_id?: string;
  business_context?: BusinessContext;
  config?: Record<string, any>;
}

export interface CreateSessionResponse {
  session_id: string;
  status: SessionStatus;
  created_at: number;
  expires_at: number;
  websocket_url: string;
}

export interface JoinSessionRequest {
  participant_id?: string;
  role: ParticipantRole;
  preferences?: Record<string, any>;
}

export interface JoinSessionResponse {
  session_id: string;
  participant_id: string;
  role: ParticipantRole;
  status: SessionStatus;
  websocket_url: string;
}

export interface EndSessionResponse {
  session_id: string;
  status: SessionStatus;
  ended_at: number;
  duration_seconds: number;
}
