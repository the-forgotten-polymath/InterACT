import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Copy,
  Check,
  ShoppingBag,
  User,
  Headphones,
  AlertCircle,
  Wifi,
  Phone,
  PhoneCall,
  PhoneOff,
  Sparkles,
  Volume2,
  VolumeX,
  Languages,
  Mic,
  MicOff,
  Activity,
  ShieldCheck,
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
import { Session, BusinessContext } from '../types/session';
import { FluencyShieldModal } from './FluencyShieldModal';
import { GestureHUDModal } from './GestureHUDModal';
import { EnrolledGesture } from '../services/gesture';

interface MessageItem {
  id: string;
  senderId: string;
  senderRole: 'customer' | 'agent' | 'system';
  text: string;
  timestamp: number;
  status: 'sending' | 'delivered';
  spokenToAgent?: boolean;
  fluencyShield?: boolean;
  rawTranscript?: string;
  disfluenciesRemoved?: string[];
  showRawDetails?: boolean;
  isGesture?: boolean;
  gestureName?: string;
  gestureEmoji?: string;
}

interface CustomerViewProps {
  autoJoinSessionId?: string | null;
  onSessionCreated?: (sessionId: string) => void;
}

export const CustomerView: React.FC<CustomerViewProps> = ({ autoJoinSessionId, onSessionCreated }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionCodeInput, setSessionCodeInput] = useState('');
  const [participantId] = useState(() => `cust_${generateUUID().substring(0, 6)}`);

  // Connection & presence
  const [connState, setConnState] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Messages & Activity
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [agentActivity, setAgentActivity] = useState<string | null>(null);

  // Phase 2 Type-to-Voice Controls (Mithi v2 Flash Integration)
  const [speechLanguage, setSpeechLanguage] = useState<string>('en-IN');
  const [selectedVoice, setSelectedVoice] = useState<string>('ahana');
  const [autoPlayAgentSpeech, setAutoPlayAgentSpeech] = useState<boolean>(true);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);

  // Phase 3 Fluency Shield Modal State
  const [isFluencyModalOpen, setIsFluencyModalOpen] = useState<boolean>(false);

  // Phase 4 Gesture Macro HUD State
  const [isGestureModalOpen, setIsGestureModalOpen] = useState<boolean>(false);

  // Real-Time WebRTC Voice Calling State
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const webrtcRef = useRef<WebRTCService>(new WebRTCService());
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const wsRef = useRef<InterACTWebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentActivity]);

  // Auto-join coordinated session if passed via props
  useEffect(() => {
    if (autoJoinSessionId && connState === 'idle' && !session) {
      connectToSession(autoJoinSessionId);
    }
  }, [autoJoinSessionId]);

  // Clean up on unmount & init WebRTC
  useEffect(() => {
    webrtcRef.current.init({
      onRemoteStream: (stream) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch((e) => console.warn('Audio play error:', e));
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
      wsRef.current?.close();
    };
  }, []);

  // Connect WebSocket to session
  const connectToSession = async (sessId: string) => {
    setConnState('connecting');
    setErrorMsg(null);

    try {
      // 1. Join session via REST API
      await InterACTApi.joinSession(sessId, {
        role: 'customer',
        participant_id: participantId,
        preferences: { channel: 'web', accessible_mode: true, speech_language: speechLanguage }
      });

      // 2. Fetch full session details
      const sessDetails = await InterACTApi.getSession(sessId);
      setSession(sessDetails);

      const hasAgent = Object.values(sessDetails.participants).some(
        (p) => p.role === 'agent' && p.connection_status === 'connected'
      );
      setIsAgentConnected(hasAgent);

      // 3. Connect WebSocket
      const wsUrl = getWebSocketUrl(sessId, participantId);

      const ws = new InterACTWebSocket(wsUrl);
      wsRef.current = ws;

      ws.onConnectionStateChange = (state) => {
        setConnState(state);
      };

      // Handle incoming events
      ws.on('*', (evt: InterACTEvent) => {
        handleIncomingEvent(evt);
      });

      ws.connect();
    } catch (err: any) {
      console.error('Failed to join session', err);
      setErrorMsg(err.message || 'Could not connect to session. Check code.');
      setConnState('disconnected');
    }
  };

  const handleIncomingEvent = (evt: InterACTEvent) => {
    switch (evt.event_type) {
      case EventType.PARTICIPANT_JOINED:
        if (evt.sender_role === 'agent') {
          setIsAgentConnected(true);
          setMessages((prev) => [
            ...prev,
            {
              id: evt.event_id,
              senderId: 'system',
              senderRole: 'system',
              text: 'Support specialist joined the session. You can now talk, type, or call.',
              timestamp: evt.timestamp,
              status: 'delivered'
            }
          ]);
        }
        break;

      case EventType.PARTICIPANT_LEFT:
        if (evt.sender_role === 'agent') {
          setIsAgentConnected(false);
          webrtcRef.current.endCall(false);
          setMessages((prev) => [
            ...prev,
            {
              id: evt.event_id,
              senderId: 'system',
              senderRole: 'system',
              text: 'Support specialist left the session.',
              timestamp: evt.timestamp,
              status: 'delivered'
            }
          ]);
        }
        break;

      case EventType.PARTICIPANT_ACTIVITY:
        if (evt.sender_role === 'agent') {
          const act = evt.payload?.activity;
          if (act === 'typing') {
            setAgentActivity('Specialist is typing a reply...');
          } else if (act === 'speaking') {
            setAgentActivity('Specialist is speaking response...');
          } else {
            setAgentActivity(null);
          }
        }
        break;

      case EventType.RTC_SIGNAL:
        if (wsRef.current) {
          webrtcRef.current.handleSignal(evt.payload, wsRef.current);
        }
        break;

      case EventType.MESSAGE_CREATED:
        if (evt.sender_id !== participantId) {
          const incomingText = evt.payload?.text || '';
          const msgId = evt.payload?.message_id || evt.event_id;

          setMessages((prev) => [
            ...prev,
            {
              id: msgId,
              senderId: evt.sender_id || 'agent',
              senderRole: (evt.sender_role as any) || 'agent',
              text: incomingText,
              timestamp: evt.timestamp,
              status: 'delivered'
            }
          ]);
          setAgentActivity(null);

          // If customer enabled "Hear Agent Replies", speak it
          if (autoPlayAgentSpeech && incomingText) {
            playMessageAudio(msgId, incomingText, 'en-US');
          }
        }
        break;

      case EventType.SESSION_ENDED:
        setConnState('disconnected');
        webrtcRef.current.endCall(false);
        setMessages((prev) => [
          ...prev,
          {
            id: evt.event_id,
            senderId: 'system',
            senderRole: 'system',
            text: 'This support session has been ended.',
            timestamp: evt.timestamp,
            status: 'delivered'
          }
        ]);
        break;
    }
  };

  // Start new demo session with Zomato Order #ZMT-4092
  const handleStartOrderDemoSession = async () => {
    setErrorMsg(null);
    setConnState('connecting');

    try {
      const orderContext: BusinessContext = {
        type: 'order',
        id: 'ZMT-4092',
        data: {
          restaurant: 'Punjab Grill Express',
          items: 'Paneer Tikka Butter Masala (x1), Garlic Naan (x2)',
          total: '₹420.00',
          eta: '12 mins ago (DELAYED)',
          driver: 'Rajesh K. (+91 98765 43210)',
          status: 'In Transit - Running Late'
        }
      };

      const newSess = await InterACTApi.createSession({
        business_context: orderContext
      });

      onSessionCreated?.(newSess.session_id);
      await connectToSession(newSess.session_id);
    } catch (err: any) {
      console.error('Failed to create session', err);
      setErrorMsg(err.message || 'Error creating support session.');
      setConnState('idle');
    }
  };

  // Join existing session by code
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sessionCodeInput.trim().toUpperCase();
    if (!code) return;
    await connectToSession(code);
  };

  // Handle typing input and anti-hangup signals
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

  // Send typed message
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text) return;

    if (!wsRef.current?.isConnected()) {
      alert('Connecting to live session... please wait a moment or rejoin.');
      return;
    }

    const messageId = `msg_${generateUUID().substring(0, 8)}`;

    const newMsg: MessageItem = {
      id: messageId,
      senderId: participantId,
      senderRole: 'customer',
      text,
      timestamp: Date.now(),
      status: 'sending',
      spokenToAgent: true
    };

    setMessages((prev) => [...prev, newMsg]);
    if (textToSend === undefined) {
      setInputText('');
    }

    // Send via WebSocket with Type-to-Voice payload metadata
    wsRef.current.sendEvent(EventType.MESSAGE_CREATED, {
      message_id: messageId,
      text,
      message_type: 'text',
      sender_role: 'customer',
      metadata: {
        spoken_to_agent: true,
        speech_language: speechLanguage,
        voice: selectedVoice,
        voice_rate: 1.0,
        synthesize: true
      }
    });

    wsRef.current.sendActivity('idle');

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    }, 200);
  };

  // Phase 3: Handle Approved Fluency Shield Speech Message
  const handleApproveFluencySpeech = (
    approvedText: string,
    rawTranscript: string,
    disfluencies: string[],
    preserved: string[]
  ) => {
    if (!approvedText.trim()) return;

    if (!wsRef.current?.isConnected()) {
      alert('Connecting to live session... please wait a moment.');
      return;
    }

    const messageId = `msg_fluency_${generateUUID().substring(0, 8)}`;

    const newMsg: MessageItem = {
      id: messageId,
      senderId: participantId,
      senderRole: 'customer',
      text: approvedText,
      timestamp: Date.now(),
      status: 'sending',
      spokenToAgent: true,
      fluencyShield: true,
      rawTranscript,
      disfluenciesRemoved: disfluencies,
      showRawDetails: false
    };

    setMessages((prev) => [...prev, newMsg]);

    // Dispatch SPEECH_APPROVED event with full audit metadata
    wsRef.current.sendEvent(EventType.SPEECH_APPROVED, {
      message_id: messageId,
      raw_transcript: rawTranscript,
      approved_text: approvedText,
      fluency_shield: true,
      disfluencies_removed: disfluencies,
      preserved_entities: preserved,
      language: speechLanguage,
      voice: selectedVoice
    });

    wsRef.current.sendActivity('idle');

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    }, 200);
  };

  // Phase 4: Handle Triggered Gesture Macro Shortcut
  const handleGestureConfirmed = (gesture: EnrolledGesture) => {
    if (!gesture || !gesture.phrase) return;

    if (!wsRef.current?.isConnected()) {
      alert('Connecting to live session... please wait a moment.');
      return;
    }

    const messageId = `msg_gesture_${generateUUID().substring(0, 8)}`;

    const newMsg: MessageItem = {
      id: messageId,
      senderId: participantId,
      senderRole: 'customer',
      text: `${gesture.emoji} [${gesture.name}]: "${gesture.phrase}"`,
      timestamp: Date.now(),
      status: 'sending',
      spokenToAgent: true,
      isGesture: true,
      gestureName: gesture.name,
      gestureEmoji: gesture.emoji
    };

    setMessages((prev) => [...prev, newMsg]);

    // Send via WebSocket with gesture macro metadata
    wsRef.current.sendEvent(EventType.GESTURE_CONFIRMED, {
      message_id: messageId,
      gesture_id: gesture.id,
      gesture_name: gesture.name,
      emoji: gesture.emoji,
      phrase: gesture.phrase
    });

    // Also send standard message so it delivers seamlessly
    wsRef.current.sendEvent(EventType.MESSAGE_CREATED, {
      message_id: messageId,
      text: `${gesture.emoji} [${gesture.name}]: "${gesture.phrase}"`,
      message_type: 'gesture',
      sender_role: 'customer',
      metadata: {
        spoken_to_agent: true,
        speech_language: speechLanguage,
        voice: selectedVoice,
        gesture_name: gesture.name,
        emoji: gesture.emoji
      }
    });

    wsRef.current.sendActivity('idle');

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    }, 200);
  };

  // Toggle raw details accordion for a message
  const toggleRawDetails = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, showRawDetails: !m.showRawDetails } : m
      )
    );
  };

  // Play audio aloud for a message
  const playMessageAudio = (msgId: string, text: string, lang = speechLanguage) => {
    if (currentlySpeakingId === msgId) {
      SpeechService.stop();
      setCurrentlySpeakingId(null);
      return;
    }

    setCurrentlySpeakingId(msgId);
    SpeechService.speak(text, {
      language: lang,
      voice: selectedVoice,
      rate: 0.95,
      onEnd: () => {
        setCurrentlySpeakingId(null);
      },
      onError: () => {
        setCurrentlySpeakingId(null);
      }
    });
  };

  const copyRoomCode = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.session_id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const quickChips = [
    'I am non-verbal. InterACT is reading my typed words to you.',
    'My order #ZMT-4092 is delayed, where is the driver?',
    'The food arrived cold, please help arrange replacement.',
    'I have special delivery instructions for my building.'
  ];

  return (
    <div className="view-container customer-portal">
      {/* Hidden audio element for WebRTC peer audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Session Inactive Screen */}
      {connState === 'idle' || (!session && connState !== 'connected') ? (
        <div className="onboarding-card">
          <div className="onboarding-header">
            <div className="onboarding-icon">
              <ShoppingBag size={28} className="text-primary-indigo" />
            </div>
            <h2>Accessible Customer Support</h2>
            <p>
              InterACT Type-to-Voice, Fluency Shield & Live Calling bridge non-verbal and speech-divergent customers with human agents in real time.
            </p>
          </div>

          <div className="onboarding-actions">
            <button
              onClick={handleStartOrderDemoSession}
              disabled={connState === 'connecting'}
              className="btn btn-primary btn-block btn-lg"
            >
              <Sparkles size={18} className="mr-2" />
              Start Live Support (Order #ZMT-4092)
            </button>

            <div className="divider">
              <span>or enter existing session code</span>
            </div>

            <form onSubmit={handleJoinByCode} className="join-code-form">
              <input
                type="text"
                placeholder="e.g. AB12CD"
                maxLength={8}
                value={sessionCodeInput}
                onChange={(e) => setSessionCodeInput(e.target.value.toUpperCase())}
                className="input-code"
              />
              <button
                type="submit"
                disabled={!sessionCodeInput.trim() || connState === 'connecting'}
                className="btn btn-secondary"
              >
                Join Room
              </button>
            </form>

            {errorMsg && (
              <div className="error-banner">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Session View */
        <div className="chat-session-layout">
          {/* Top Session Bar */}
          <div className="session-topbar">
            <div className="session-info">
              <div className="room-code-badge" onClick={copyRoomCode} title="Click to copy code">
                <span className="label">ROOM CODE</span>
                <span className="code">{session?.session_id}</span>
                {copiedCode ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
              </div>

              <div className="connection-indicator">
                <span className={`status-dot ${connState === 'connected' ? 'online' : 'connecting'}`} />
                <span className="status-label">
                  {connState === 'connected' ? 'Connected' : 'Reconnecting...'}
                </span>
              </div>
            </div>

            <div className="participant-badges">
              <div className={`agent-badge ${isAgentConnected ? 'agent-online' : 'agent-offline'}`}>
                <Headphones size={14} />
                <span>{isAgentConnected ? 'Specialist Online' : 'Specialist Connecting...'}</span>
              </div>

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
                    title="Start Live WebRTC Audio Call with Specialist"
                  >
                    <Phone size={14} className="mr-1" />
                    <span>Start Voice Call</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Incoming Call Alert from Agent */}
          {callState === 'incoming' && (
            <div className="incoming-call-alert">
              <div className="incoming-call-info">
                <PhoneCall size={20} className="pulse-icon text-emerald" />
                <div>
                  <strong>Incoming Voice Call from Support Agent</strong>
                  <p>Specialist wants to speak with you live over WebRTC audio.</p>
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

          {/* Type-to-Voice & Fluency Shield Control Banner */}
          <div className="type-to-voice-bar">
            <div className="ttv-left">
              <div className="ttv-pill">
                <Mic size={14} className="text-primary-indigo" />
                <span className="font-semibold">Type-to-Voice & Fluency Shield</span>
              </div>
              <span className="ttv-hint">Your words are spoken in natural Indian voice</span>
            </div>

            <div className="ttv-controls">
              {/* Language Selection */}
              <div className="language-selector-wrapper">
                <Languages size={14} className="text-muted" />
                <select
                  value={speechLanguage}
                  onChange={(e) => setSpeechLanguage(e.target.value)}
                  className="speech-lang-select"
                  aria-label="Select Voice Accent and Language"
                >
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">Hindi (हिन्दी)</option>
                  <option value="en-US">English (US)</option>
                  <option value="bn">Bengali (বাংলা)</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                  <option value="te">Telugu (తెలుగు)</option>
                </select>
              </div>

              {/* Mithi v2 Flash Voice Selection */}
              <div className="language-selector-wrapper">
                <Mic size={14} className="text-primary-indigo" />
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="speech-lang-select"
                  aria-label="Select Mithi v2 Flash Voice"
                >
                  <optgroup label="Mithi v2 Flash (Female)">
                    <option value="ahana">Ahana (Female)</option>
                    <option value="charvi">Charvi (Female)</option>
                    <option value="vaidehi">Vaidehi (Female)</option>
                    <option value="malini">Malini (Female)</option>
                    <option value="jahnavi">Jahnavi (Female)</option>
                  </optgroup>
                  <optgroup label="Mithi v2 Flash (Male)">
                    <option value="satvik">Satvik (Male)</option>
                    <option value="anirban">Anirban (Male)</option>
                    <option value="nakul">Nakul (Male)</option>
                    <option value="vasant">Vasant (Male)</option>
                    <option value="siddhant">Siddhant (Male)</option>
                  </optgroup>
                </select>
              </div>

              {/* Auto-read Agent Speech Toggle */}
              <button
                type="button"
                onClick={() => setAutoPlayAgentSpeech(!autoPlayAgentSpeech)}
                className={`btn-toggle-audio ${autoPlayAgentSpeech ? 'active' : ''}`}
                title={autoPlayAgentSpeech ? 'Audio on: Speaking agent replies' : 'Audio muted'}
              >
                {autoPlayAgentSpeech ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span className="toggle-text">{autoPlayAgentSpeech ? 'Audio On' : 'Muted'}</span>
              </button>
            </div>
          </div>

          {/* Business Order Context Banner */}
          {session?.business_context?.data && (
            <div className="order-context-banner">
              <div className="context-item">
                <ShoppingBag size={14} className="text-accent-amber" />
                <span className="strong">Zomato Order #{session.business_context.id}:</span>
                <span className="details">{session.business_context.data.restaurant}</span>
              </div>
              <div className="context-item eta">
                <span>{session.business_context.data.eta}</span>
              </div>
            </div>
          )}

          {/* Message Stream */}
          <div className="message-stream">
            {messages.length === 0 && (
              <div className="empty-chat-hint">
                <Sparkles size={24} className="text-primary-indigo" />
                <p>Type below or use the Fluency Shield. InterACT speaks your words aloud to the agent.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message-bubble-wrapper ${
                  msg.senderRole === 'customer'
                    ? 'customer-wrapper'
                    : msg.senderRole === 'agent'
                    ? 'agent-wrapper'
                    : 'system-wrapper'
                }`}
              >
                {msg.senderRole === 'system' ? (
                  <div className="system-pill">{msg.text}</div>
                ) : (
                  <div className={`message-bubble ${msg.senderRole}`}>
                    <div className="message-header">
                      <span className="sender-tag">
                        {msg.senderRole === 'customer' ? 'You' : 'Specialist'}
                      </span>
                      <span className="time-tag">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <p className="message-text">{msg.text}</p>

                    <div className="message-footer">
                      {msg.isGesture ? (
                        <div className="speech-badge gesture-badge">
                          <Hand size={12} className="text-emerald" />
                          <span>{msg.gestureEmoji || '✋'} Gesture Macro</span>
                        </div>
                      ) : msg.fluencyShield ? (
                        <div className="speech-badge fluency-badge">
                          <ShieldCheck size={12} className="text-emerald" />
                          <span>Fluency Shield Approved</span>
                        </div>
                      ) : msg.spokenToAgent ? (
                        <div className="speech-badge">
                          <Mic size={11} />
                          <span>Spoken to Agent</span>
                        </div>
                      ) : null}

                      {/* Listen / Replay Audio Button */}
                      <button
                        type="button"
                        onClick={() => playMessageAudio(msg.id, msg.text)}
                        className={`btn-listen ${currentlySpeakingId === msg.id ? 'playing' : ''}`}
                        title="Listen to synthesized voice"
                      >
                        <Volume2 size={13} />
                        <span>{currentlySpeakingId === msg.id ? 'Speaking...' : 'Listen'}</span>
                      </button>
                    </div>

                    {/* Expandable Raw Transcript for Fluency Shield */}
                    {msg.fluencyShield && msg.rawTranscript && (
                      <div className="fluency-audit-box">
                        <button
                          type="button"
                          onClick={() => toggleRawDetails(msg.id)}
                          className="btn-toggle-audit"
                        >
                          {msg.showRawDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          <span>Original raw speech: "{msg.rawTranscript}"</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Specialist Typing / Speaking Activity */}
            {agentActivity && (
              <div className="activity-indicator">
                <Activity size={14} className="pulse-icon text-primary-indigo" />
                <span>{agentActivity}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Accessibility Quick Response Chips */}
          <div className="quick-chips-row">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="chip-btn"
                onClick={() => handleSendMessage(chip)}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Composer with Fluency Shield Button */}
          <div className="composer-container">
            <div className="composer-input-row">
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
                placeholder="Type your message here (spoken aloud) or tap Fluency Shield..."
                className="chat-textarea"
              />

              <div className="composer-action-buttons">
                {/* Phase 3 Fluency Shield Button */}
                <button
                  type="button"
                  onClick={() => setIsFluencyModalOpen(true)}
                  className="btn btn-fluency"
                  title="Speak with Fluency Shield (Disfluency cleaning & customer approval)"
                >
                  <ShieldCheck size={18} className="text-primary-indigo" />
                  <span>Fluency Shield</span>
                </button>

                {/* Phase 4 Gesture Macro HUD Button */}
                <button
                  type="button"
                  onClick={() => setIsGestureModalOpen(true)}
                  className="btn btn-gesture"
                  title="Hands-free Gesture Shortcuts (Hold hand to camera to speak)"
                >
                  <Hand size={18} className="text-emerald" />
                  <span>Gestures</span>
                </button>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || connState !== 'connected'}
                  className="btn btn-primary btn-send"
                  title="Send and Speak to Agent"
                >
                  <Send size={18} />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Fluency Shield Dual Transcript Review Modal */}
      <FluencyShieldModal
        isOpen={isFluencyModalOpen}
        onClose={() => {
          setIsFluencyModalOpen(false);
          if (wsRef.current?.isConnected()) {
            wsRef.current.sendActivity('idle');
          }
        }}
        onStartReviewing={() => {
          if (wsRef.current?.isConnected()) {
            wsRef.current.sendActivity('reviewing');
          }
        }}
        onApprove={handleApproveFluencySpeech}
        speechLanguage={speechLanguage}
      />

      {/* Phase 4: Personalized Gesture Macros HUD Modal */}
      <GestureHUDModal
        isOpen={isGestureModalOpen}
        onClose={() => {
          setIsGestureModalOpen(false);
          if (wsRef.current?.isConnected()) {
            wsRef.current.sendActivity('idle');
          }
        }}
        onGestureConfirmed={handleGestureConfirmed}
        onActivityChange={(activity) => {
          if (wsRef.current?.isConnected()) {
            wsRef.current.sendActivity(activity);
          }
        }}
      />
    </div>
  );
};
