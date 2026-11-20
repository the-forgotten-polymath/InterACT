import type { Participant, Track, TrackPublication } from 'livekit-client';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderIdentity: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

export interface LiveKitConfig {
  livekitUrl: string;
  apiKey?: string;
  apiSecret?: string;
  token?: string;
}

export interface TrackItem {
  participant: Participant;
  publication?: TrackPublication;
  track?: Track;
  isLocal: boolean;
  source: Track.Source;
  kind: Track.Kind;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
}
