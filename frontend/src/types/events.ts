import { ParticipantRole } from './session';

export const EventType = {
  // Session lifecycle
  SESSION_CREATED: 'session.created',
  SESSION_JOINED: 'session.joined',
  SESSION_ENDED: 'session.ended',
  
  // Participants
  PARTICIPANT_JOINED: 'participant.joined',
  PARTICIPANT_LEFT: 'participant.left',
  PARTICIPANT_ACTIVITY: 'participant.activity',
  
  // Messages
  MESSAGE_CREATED: 'message.created',
  MESSAGE_DELIVERED: 'message.delivered',
  
  // Fluency Shield / Speech Assistance
  SPEECH_TRANSCRIBED: 'speech.transcribed',
  SPEECH_RECONSTRUCTED: 'speech.reconstructed',
  SPEECH_APPROVED: 'speech.approved',
  
  // Gesture Macros
  GESTURE_DETECTED: 'gesture.detected',
  GESTURE_CONFIRMED: 'gesture.confirmed',
  
  // Smart Voice Chips
  CHIPS_SUGGESTED: 'chips.suggested',
  CHIP_SELECTED: 'chip.selected',
  
  // Visual Cards
  CARD_SENT: 'card.sent',
  CARD_ACTION: 'card.action',
  
  // Real-Time WebRTC Calling
  RTC_SIGNAL: 'rtc.signal',
  
  // Heartbeat & System
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error'
} as const;

export type EventType = typeof EventType[keyof typeof EventType];

export type ActivityType =
  | 'typing'
  | 'recording'
  | 'transcribing'
  | 'reviewing'
  | 'processing_gesture'
  | 'idle';

export type MessageSource = 'text' | 'speech' | 'gesture' | 'smart_chip';

export interface InterACTEvent<T = any> {
  event_id: string;
  event_type: EventType;
  session_id: string;
  timestamp: number;
  sender_id?: string;
  sender_role?: ParticipantRole;
  payload: T;
}

export interface MessagePayload {
  message_id: string;
  source: MessageSource;
  text: string;
  language?: string;
  audio_url?: string;
  metadata?: Record<string, any>;
}

export interface ActivityPayload {
  activity: ActivityType;
  progress?: number;
  label?: string;
}

export interface SpeechTranscribedPayload {
  audio_duration_ms: number;
  raw_transcript: string;
  confidence: number;
  disfluencies_detected: string[];
}

export interface SpeechReconstructedPayload {
  original_transcript: string;
  reconstructed_text: string;
  confidence_score: number;
  changes_summary: string;
}

export interface GestureDetectedPayload {
  gesture_name: string;
  confidence: number;
  assigned_action: string;
  countdown_seconds: number;
}

export interface SpeechApprovedPayload {
  message_id: string;
  raw_transcript: string;
  approved_text: string;
  fluency_shield: boolean;
  confidence_score?: number;
  disfluencies_removed?: string[];
  preserved_entities?: string[];
  language?: string;
}
