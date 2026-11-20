import React, { useState, useEffect, useRef } from 'react';
import {
  Headphones,
  Send,
  Copy,
  Check,
  ShoppingBag,
  User,
  AlertCircle,
  Wifi,
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Activity,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Hand
} from 'lucide-react';
import { InterACTApi, getWebSocketUrl } from '../services/api';
import { InterACTWebSocket } from '../services/websocket';
import { SpeechService } from '../services/speech';
import { WebRTCService, CallState } from '../services/webrtc';
import { generateUUID } from '../utils/uuid';
import { InterACTEvent, EventType, MessagePayload } from '../types/events';
import { Session } from '../types/session';

interface MessageItem {
  id: string;
  senderId: string;
  senderRole: 'customer' | 'agent' | 'system';
  text: string;
  timestamp: number;
  spokenToAgent?: boolean;
  speechLanguage?: string;
  fluencyShield?: boolean;
  rawTranscript?: string;
  disfluenciesRemoved?: string[];
  showRawDetails?: boolean;
  isGesture?: boolean;
  gestureName?: string;
  gestureEmoji?: string;
}

interface AgentDashboardProps {
  autoJoinSessionId?: string | null;
}

export const AgentDashboard: React.FC<AgentDashboardProps> = ({ autoJoinSessionId }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [participantId] = useState(() => `agent_${generateUUID().substring(0, 6)}`);

  // Connection & presence
  const [connState, setConnState] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [isCustomerConnected, setIsCustomerConnected] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Messages & Activity
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [customerActivity, setCustomerActivity] = useState<string | null>(null);

  // Phase 2 Speech Controls for Agent
  const [autoPlayCustomerVoice, setAutoPlayCustomerVoice] = useState<boolean>(true);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [voiceTranscriptInterim, setVoiceTranscriptInterim] = useState<string>('');

  // Real-Time WebRTC Voice Calling State
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const webrtcRef = useRef<WebRTCService>(new WebRTCService());
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const wsRef = useRef<InterACTWebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, customerActivity, voiceTranscriptInterim]);

  // Auto-join coordinated session if passed via props
  useEffect(() => {
    if (autoJoinSessionId && connState === 'idle' && !session) {
      connectToSession(autoJoinSessionId);
    }
  }, [autoJoinSessionId]);

  useEffect(() => {
    webrtcRef.current.init({
      onRemoteStream: (stream) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch((e) => console.warn('Agent audio play error:', e));
        }
      },
      onCallStateChange: (state, err) => {
        setCallState(state);
        if (err) setErrorMsg(err);
      }
    });

    return () => {
      webrtcRef.current.endCall(false);
      SpeechService.stop();
      SpeechService.stopListening();
      wsRef.current?.close();
    };
  }, []);

  const connectToSession = async (sessId: string) => {
    setConnState('connecting');
    setErrorMsg(null);

    try {
      // 1. Join session via REST API
      await InterACTApi.joinSession(sessId, {
        role: 'agent',
        participant_id: participantId,
        preferences: { channel: 'agent_console' }
      });

      // 2. Fetch full session details
      const sessDetails = await InterACTApi.getSession(sessId);
      setSession(sessDetails);

      const hasCustomer = Object.values(sessDetails.participants).some(
        (p) => p.role === 'customer' && p.connection_status === 'connected'
      );
      setIsCustomerConnected(hasCustomer);

      // 3. Connect WebSocket
      const wsUrl = getWebSocketUrl(sessId, participantId);

      const ws = new InterACTWebSocket(wsUrl);
      wsRef.current = ws;

      ws.onConnectionStateChange = (state) => {
        setConnState(state);
      };

      ws.on('*', (evt: InterACTEvent) => {
        handleIncomingEvent(evt);
      });

      ws.connect();
    } catch (err: any) {
      console.error('Failed to join as agent', err);
      setErrorMsg(err.message || 'Could not connect to session. Check code.');
      setConnState('idle');
    }
  };

  const handleIncomingEvent = (evt: InterACTEvent) => {
    switch (evt.event_type) {
      case EventType.PARTICIPANT_JOINED:
        if (evt.sender_role === 'customer') {
          setIsCustomerConnected(true);
          setMessages((prev) => [
            ...prev,
            {
              id: evt.event_id,
              senderId: 'system',
              senderRole: 'system',
              text: 'Customer connected via Accessible InterACT Portal.',
              timestamp: evt.timestamp
            }
          ]);
        }
        break;

      case EventType.PARTICIPANT_LEFT:
        if (evt.sender_role === 'customer') {
          setIsCustomerConnected(false);
          setMessages((prev) => [
            ...prev,
            {
              id: evt.event_id,
              senderId: 'system',
              senderRole: 'system',
              text: 'Customer disconnected.',
              timestamp: evt.timestamp
            }
          ]);
        }
        break;

      case EventType.PARTICIPANT_ACTIVITY:
        if (evt.sender_role === 'customer') {
          const act = evt.payload?.activity;
          if (act === 'typing') {
            setCustomerActivity('Customer is actively typing...');
          } else if (act === 'reviewing') {
            setCustomerActivity('Customer is reviewing speech with Fluency Shield...');
          } else if (act === 'gesturing') {
            setCustomerActivity('Customer is preparing gesture shortcut...');
          } else {
            setCustomerActivity(null);
          }
        }
        break;

      case EventType.MESSAGE_CREATED:
        if (evt.sender_id !== participantId) {
          const incomingText = evt.payload?.text || '';
          const msgId = evt.payload?.message_id || evt.event_id;
          const isSpoken = !!evt.payload?.metadata?.spoken_to_agent;
          const speechLang = evt.payload?.metadata?.speech_language || 'en-IN';

          setMessages((prev) => [
            ...prev,
            {
              id: msgId,
              senderId: evt.sender_id || 'customer',
              senderRole: evt.sender_role as any,
              text: incomingText,
              timestamp: evt.timestamp,
              spokenToAgent: isSpoken,
              speechLanguage: speechLang
            }
          ]);
          setCustomerActivity(null);

          // Auto-play customer typed message aloud to agent
          if (autoPlayCustomerVoice && incomingText) {
            playCustomerSpeech(msgId, incomingText, speechLang);
          }
        }
        break;

      // Phase 3: Fluency Shield Approved Speech Event
      case EventType.SPEECH_APPROVED: {
        const payload = evt.payload || {};
        const approvedText = payload.approved_text || payload.text || '';
        const rawTranscript = payload.raw_transcript || '';
        const msgId = payload.message_id || evt.event_id;
        const speechLang = payload.language || 'en-IN';

        setMessages((prev) => [
          ...prev,
          {
            id: msgId,
            senderId: evt.sender_id || 'customer',
            senderRole: 'customer',
            text: approvedText,
            timestamp: evt.timestamp,
            spokenToAgent: true,
            speechLanguage: speechLang,
            fluencyShield: true,
            rawTranscript,
            disfluenciesRemoved: payload.disfluencies_removed || [],
            showRawDetails: false
          }
        ]);
        setCustomerActivity(null);

        // Automatically synthesize and speak customer approved speech to agent
        if (autoPlayCustomerVoice && approvedText) {
          playCustomerSpeech(msgId, approvedText, speechLang);
        }
        break;
      }

      // Phase 4: Customer Gesture Macro Confirmed Event
      case EventType.GESTURE_CONFIRMED: {
        const payload = evt.payload || {};
        const phrase = payload.phrase || '';
        const gestureName = payload.gesture_name || 'Gesture';
        const emoji = payload.emoji || '✋';
        const msgId = payload.message_id || evt.event_id;

        setMessages((prev) => {
          if (prev.some((m) => m.id === msgId)) return prev;
          return [
            ...prev,
            {
              id: msgId,
              senderId: evt.sender_id || 'customer',
              senderRole: 'customer',
              text: `${emoji} [${gestureName}]: "${phrase}"`,
              timestamp: evt.timestamp,
              spokenToAgent: true,
              speechLanguage: 'en-IN',
              isGesture: true,
              gestureName,
              gestureEmoji: emoji
            }
          ];
        });
        setCustomerActivity(null);

        // Auto-play gesture speech aloud to agent
        if (autoPlayCustomerVoice && phrase) {
          playCustomerSpeech(msgId, phrase, 'en-IN');
        }
        break;
      }

      case EventType.RTC_SIGNAL:
        if (wsRef.current) {
          webrtcRef.current.handleSignal(evt.payload, wsRef.current);
        }
        break;

      case EventType.SESSION_ENDED:
        setConnState('disconnected');
        setMessages((prev) => [
          ...prev,
          {
            id: evt.event_id,
            senderId: 'system',
            senderRole: 'system',
            text: 'Session has been ended.',
            timestamp: evt.timestamp
          }
        ]);
        break;
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sessionCodeInput.trim().toUpperCase();
    if (!code) return;
    await connectToSession(code);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    if (wsRef.current?.isConnected()) {
      wsRef.current.sendActivity('typing');

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.isConnected()) {
          wsRef.current.sendActivity('idle');
        }
      }, 2000);
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !wsRef.current?.isConnected()) return;

    const messageId = `msg_${generateUUID().substring(0, 8)}`;

    const newMsg: MessageItem = {
      id: messageId,
      senderId: participantId,
      senderRole: 'agent',
      text,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, newMsg]);
    if (textToSend === undefined) {
      setInputText('');
    }

    // Broadcast message to session
    wsRef.current.sendEvent(EventType.MESSAGE_CREATED, {
      message_id: messageId,
      text,
      message_type: 'text',
      sender_role: 'agent',
      metadata: {
        agent_voice: false
      }
    });

    wsRef.current.sendActivity('idle');
  };

  // Play / Replay speech for customer message
  const playCustomerSpeech = (msgId: string, text: string, lang = 'en-IN', voice = 'ahana') => {
    if (currentlySpeakingId === msgId) {
      SpeechService.stop();
      setCurrentlySpeakingId(null);
      return;
    }

    setCurrentlySpeakingId(msgId);
    SpeechService.speak(text, {
      language: lang,
      voice,
      rate: 1.0,
      onEnd: () => {
        setCurrentlySpeakingId(null);
      },
      onError: () => {
        setCurrentlySpeakingId(null);
      }
    });
  };

  // Toggle raw details accordion for a message
  const toggleRawDetails = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, showRawDetails: !m.showRawDetails } : m
      )
    );
  };

  // Toggle Agent Voice Input (Voice-to-Text STT)
  const toggleVoiceRecording = () => {
    if (isRecordingVoice) {
      SpeechService.stopListening();
      setIsRecordingVoice(false);
      if (wsRef.current?.isConnected()) {
        wsRef.current.sendActivity('idle');
      }
      return;
    }

    if (!SpeechService.isSpeechRecognitionSupported()) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or type your response.');
      return;
    }

    setIsRecordingVoice(true);
    setVoiceTranscriptInterim('');
    if (wsRef.current?.isConnected()) {
      wsRef.current.sendActivity('speaking');
    }

    SpeechService.startListening({
      language: 'en-US',
      onInterim: (interim) => {
        setVoiceTranscriptInterim(interim);
      },
      onFinal: (finalText) => {
        setInputText((prev) => (prev ? `${prev} ${finalText}` : finalText));
        setVoiceTranscriptInterim('');
      },
      onError: (err) => {
        console.warn('Speech recognition error:', err);
        setIsRecordingVoice(false);
        if (wsRef.current?.isConnected()) {
          wsRef.current.sendActivity('idle');
        }
      },
      onEnd: () => {
        setIsRecordingVoice(false);
        if (wsRef.current?.isConnected()) {
          wsRef.current.sendActivity('idle');
        }
      }
    });
  };

  const handleEndSession = async () => {
    if (!session) return;
    if (window.confirm('Are you sure you want to conclude this support session?')) {
      try {
        await InterACTApi.endSession(session.session_id);
        wsRef.current?.sendEvent(EventType.SESSION_ENDED, { reason: 'agent_concluded' });
        setConnState('disconnected');
      } catch (err) {
        console.error('Error ending session', err);
      }
    }
  };

  const copyRoomCode = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.session_id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="view-container agent-console">
      {/* Session Inactive Screen */}
      {connState === 'idle' || (!session && connState !== 'connected') ? (
        <div className="onboarding-card">
          <div className="onboarding-header">
            <div className="onboarding-icon">
              <Headphones size={28} className="text-primary-indigo" />
            </div>
            <h2>InterACT Agent Support Console</h2>
            <p>
              Accept incoming multimodal sessions, listen to real-time synthesized customer voice, and assist non-verbal or speech-divergent customers seamlessly.
            </p>
          </div>

          <div className="onboarding-actions">
            <form onSubmit={handleJoinByCode} className="join-code-form">
              <input
                type="text"
                placeholder="Enter Customer Room Code (e.g. AB12CD)"
                maxLength={8}
                value={sessionCodeInput}
                onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
                className="input-code"
                autoFocus
              />
              <button
                type="submit"
                disabled={!sessionCodeInput.trim() || connState === 'connecting'}
                className="btn btn-primary"
              >
                Accept Session
              </button>
            </form>

            <div className="support-hint">
              <Sparkles size={14} className="text-accent-amber" />
              <span>Tip: In desktop Split View, click "Start Live Support" on the left and enter the room code here.</span>
            </div>

            {errorMsg && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Agent Dashboard Layout */
        <div className="agent-active-layout">
          {/* Main Conversation Column */}
          <div className="agent-main-col">
            {/* Top Bar */}
            <div className="agent-topbar">
              <div className="agent-session-details">
                <div className="room-code-badge" onClick={copyRoomCode} title="Copy Code">
                  <span className="label">SESSION</span>
                  <span className="code">{session?.session_id}</span>
                  {copiedCode ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                </div>

                <div className="participant-tag">
                  <User size={13} />
                  <span>{isCustomerConnected ? 'Customer Connected' : 'Waiting for Customer...'}</span>
                  <span className={`status-dot ${isCustomerConnected ? 'online' : 'connecting'}`} />
                </div>
              </div>

              {/* WebRTC Audio Call Controls */}
              <div className="agent-topbar-controls">
                {/* Hidden Audio Element for WebRTC audio playback */}
                <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

                {/* WebRTC Live Voice Call Buttons */}
                <div className="voice-call-topbar-action">
                  {callState === 'connected' ? (
                    <div className="call-live-badge">
                      <Phone size={14} className="mr-1 text-emerald" />
                      <span>Live Call Active</span>
                      <button
                        type="button"
                        onClick={() => setIsMuted(webrtcRef.current.toggleMute())}
                        className="btn btn-xs btn-outline"
                      >
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        type="button"
                        onClick={() => webrtcRef.current.endCall(true, wsRef.current!)}
                        className="btn btn-xs btn-danger"
                      >
                        End Call
                      </button>
                    </div>
                  ) : callState === 'calling' ? (
                    <div className="call-live-badge calling">
                      <PhoneCall size={14} className="pulse-icon mr-1" />
                      <span>Connecting Audio...</span>
                      <button
                        type="button"
                        onClick={() => webrtcRef.current.endCall(true, wsRef.current!)}
                        className="btn btn-xs btn-outline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => wsRef.current && webrtcRef.current.startCall(wsRef.current)}
                      className="btn btn-call btn-sm"
                      title="Call Customer over WebRTC Voice"
                    >
                      <Phone size={14} className="mr-1" />
                      <span>Call Customer</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAutoPlayCustomerVoice(!autoPlayCustomerVoice)}
                  className={`btn-toggle-audio ${autoPlayCustomerVoice ? 'active' : ''}`}
                  title={autoPlayCustomerVoice ? 'Auto-TTS Active: Playing customer voice' : 'TTS Muted'}
                >
                  {autoPlayCustomerVoice ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  <span className="toggle-text">
                    {autoPlayCustomerVoice ? 'Auto-Voice On' : 'Voice Muted'}
                  </span>
                </button>

                <button
                  onClick={handleEndSession}
                  className="btn btn-outline-danger btn-sm"
                  title="Conclude Session"
                >
                  <PhoneOff size={14} className="mr-1" />
                  <span>Conclude Session</span>
                </button>
              </div>
            </div>

            {/* Incoming WebRTC Audio Call Alert */}
            {callState === 'incoming' && (
              <div className="incoming-call-alert">
                <div className="incoming-call-info">
                  <PhoneCall size={20} className="pulse-icon text-emerald" />
                  <div>
                    <strong>Incoming Voice Call from Customer</strong>
                    <p>Customer initiated a direct WebRTC audio call.</p>
                  </div>
                </div>
                <div className="incoming-call-actions">
                  <button
                    type="button"
                    onClick={() => wsRef.current && webrtcRef.current.acceptIncomingCall(wsRef.current)}
                    className="btn btn-success btn-sm"
                  >
                    <Phone size={14} className="mr-1" /> Answer Call
                  </button>
                  <button
                    type="button"
                    onClick={() => wsRef.current && webrtcRef.current.declineCall(wsRef.current)}
                    className="btn btn-outline-danger btn-sm"
                  >
                    <PhoneOff size={14} className="mr-1" /> Decline
                  </button>
                </div>
              </div>
            )}

            {/* Anti-Hangup Notice */}
            <div className="anti-hangup-banner">
              <div className="banner-left">
                <ShieldCheck size={16} className="text-emerald" />
                <span className="strong">Accessibility Call Protected:</span>
                <span>Customer is using InterACT Type-to-Voice and Fluency Shield. Please allow extended response time. Do not disconnect.</span>
              </div>
            </div>

            {/* Message Stream */}
            <div className="agent-message-stream">
              {messages.length === 0 && (
                <div className="empty-chat-hint">
                  <Headphones size={24} className="text-primary-indigo" />
                  <p>Session started. Customer typed & Fluency Shield messages will automatically play aloud through your speaker.</p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`agent-msg-wrapper ${
                    msg.senderRole === 'customer'
                      ? 'customer-side'
                      : msg.senderRole === 'agent'
                      ? 'agent-side'
                      : 'system-side'
                  }`}
                >
                  {msg.senderRole === 'system' ? (
                    <div className="system-pill">{msg.text}</div>
                  ) : (
                    <div className={`agent-msg-bubble ${msg.senderRole}`}>
                      <div className="msg-header">
                        <span className="author">
                          {msg.isGesture
                            ? `Customer (${msg.gestureEmoji || '✋'} Gesture Macro: ${msg.gestureName})`
                            : msg.fluencyShield
                            ? 'Customer (Fluency Shield Approved)'
                            : msg.senderRole === 'customer'
                            ? 'Customer (Type-to-Voice)'
                            : 'You (Agent)'}
                        </span>
                        <span className="timestamp">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className="msg-body">{msg.text}</div>

                      {/* Customer Voice Replay & Fluency Shield Metadata */}
                      {msg.senderRole === 'customer' && (
                        <div className="msg-audio-actions">
                          <button
                            type="button"
                            onClick={() => playCustomerSpeech(msg.id, msg.text, msg.speechLanguage)}
                            className={`btn-replay-speech ${currentlySpeakingId === msg.id ? 'speaking' : ''}`}
                            title="Replay customer voice synthesized speech"
                          >
                            <Volume2 size={13} />
                            <span>{currentlySpeakingId === msg.id ? 'Speaking aloud...' : 'Replay Voice'}</span>
                          </button>

                          {msg.fluencyShield && msg.rawTranscript && (
                            <button
                              type="button"
                              onClick={() => toggleRawDetails(msg.id)}
                              className="btn-show-audit"
                              title="View raw transcript and disfluencies"
                            >
                              <ShieldCheck size={12} className="text-emerald mr-1" />
                              <span>{msg.showRawDetails ? 'Hide Raw' : 'View Raw Speech'}</span>
                              {msg.showRawDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Expandable Raw Transcript Audit Box */}
                      {msg.fluencyShield && msg.showRawDetails && msg.rawTranscript && (
                        <div className="agent-raw-speech-box">
                          <span className="raw-header">Original Customer Raw Speech (Preserved):</span>
                          <p className="raw-content">"{msg.rawTranscript}"</p>
                          {msg.disfluenciesRemoved && msg.disfluenciesRemoved.length > 0 && (
                            <div className="disfluencies-tags">
                              <span className="tag-header">Disfluencies removed by customer approval:</span>
                              <div className="tags-row">
                                {msg.disfluenciesRemoved.map((d, i) => (
                                  <span key={i} className="audit-pill">{d}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Customer Real-Time Activity with Anti-Hangup */}
              {customerActivity && (
                <div className="agent-customer-activity">
                  <Activity size={14} className="pulse-icon text-accent-amber" />
                  <span>{customerActivity}</span>
                </div>
              )}

              {/* Voice recording interim preview */}
              {isRecordingVoice && (
                <div className="voice-preview-banner">
                  <Mic size={14} className="pulse-icon text-accent-rose" />
                  <span>Listening to your voice... {voiceTranscriptInterim && `"${voiceTranscriptInterim}"`}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Agent Composer with Voice-to-Text */}
            <div className="agent-composer">
              <div className="composer-row">
                <textarea
                  rows={2}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type reply or click 'Speak' to transcribe voice..."
                  className="agent-textarea"
                />

                <div className="composer-btns">
                  {/* Agent Voice-to-Text Mic */}
                  <button
                    type="button"
                    onClick={toggleVoiceRecording}
                    className={`btn btn-mic ${isRecordingVoice ? 'recording' : ''}`}
                    title={isRecordingVoice ? 'Stop Mic' : 'Speak to Transcribe (Voice-to-Text)'}
                  >
                    {isRecordingVoice ? <MicOff size={18} /> : <Mic size={18} />}
                    <span>{isRecordingVoice ? 'Listening...' : 'Speak'}</span>
                  </button>

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || connState !== 'connected'}
                    className="btn btn-primary"
                  >
                    <Send size={16} />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Business & Order Context Sidebar */}
          <div className="agent-sidebar">
            <div className="sidebar-card">
              <div className="sidebar-header">
                <ShoppingBag size={18} className="text-accent-amber" />
                <h3>Order Context</h3>
              </div>

              {session?.business_context?.data ? (
                <div className="order-details-grid">
                  <div className="detail-item">
                    <span className="label">Order ID</span>
                    <span className="value strong">#{session.business_context.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Restaurant</span>
                    <span className="value">{session.business_context.data.restaurant}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Items</span>
                    <span className="value">{session.business_context.data.items}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Total Amount</span>
                    <span className="value text-emerald">{session.business_context.data.total}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Status</span>
                    <span className="badge-warning">{session.business_context.data.status}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">ETA</span>
                    <span className="value text-accent-rose">{session.business_context.data.eta}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Assigned Driver</span>
                    <span className="value">{session.business_context.data.driver}</span>
                  </div>
                </div>
              ) : (
                <p className="no-data-hint">No order context attached to this session.</p>
              )}
            </div>

            <div className="sidebar-card">
              <div className="sidebar-header">
                <ShieldCheck size={18} className="text-emerald" />
                <h3>Phase 3: Fluency Shield</h3>
              </div>
              <p className="feature-explainer">
                • <strong>Disfluency-Aware:</strong> Cleans stuttering, syllable blocks, and repetitions.<br />
                • <strong>Customer Approval Gate:</strong> Customer retains 100% control and must approve before message is transmitted.<br />
                • <strong>Preserved Semantics:</strong> Negations ("not"), questions, and order entities are never altered.<br />
                • <strong>Transparency:</strong> You can inspect the original raw transcript at any time for safety.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
