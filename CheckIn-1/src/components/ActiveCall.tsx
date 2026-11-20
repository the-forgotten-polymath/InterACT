import React, { useState, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type RemoteParticipant,
  type Participant
} from 'livekit-client';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Copy,
  Check,
  SwitchCamera,
  AlertTriangle,
  Users,
  ShieldCheck
} from 'lucide-react';
import { VideoTile } from './VideoTile';
import { ChatDrawer } from './ChatDrawer';
import { generateUUID } from '../utils/uuid';
import type { ChatMessage } from '../types';

interface ActiveCallProps {
  roomCode: string;
  userName: string;
  token: string;
  livekitUrl: string;
  initialVideo: boolean;
  initialAudio: boolean;
  selectedVideoDeviceId?: string;
  selectedAudioDeviceId?: string;
  onLeave: () => void;
}

export const ActiveCall: React.FC<ActiveCallProps> = ({
  roomCode,
  userName,
  token,
  livekitUrl,
  initialVideo,
  initialAudio,
  selectedVideoDeviceId,
  selectedAudioDeviceId,
  onLeave
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [connState, setConnState] = useState<ConnectionState>(ConnectionState.Connecting);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Participants
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [activeSpeakerIds, setActiveSpeakerIds] = useState<Set<string>>(new Set());

  // Track toggles
  const [isMicEnabled, setIsMicEnabled] = useState(initialAudio);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideo);

  // Local tracks
  const [localVideoTrack, setLocalVideoTrack] = useState<Track | undefined>();

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Call timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Mobile camera flip support
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // PiP local video corner
  const [pipPosition, setPipPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');

  // Trigger state refresh for tracks
  const [, setTrackUpdateCounter] = useState(0);
  const refreshTracks = () => setTrackUpdateCounter(c => c + 1);

  // Timer
  useEffect(() => {
    if (connState !== ConnectionState.Connected) return;
    const interval = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [connState]);

  // Main LiveKit Room Lifecycle
  useEffect(() => {
    let isCancelled = false;
    const lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    setRoom(lkRoom);

    // Event handlers
    lkRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (isCancelled) return;
      setConnState(state);
    });

    lkRoom.on(RoomEvent.ParticipantConnected, () => {
      if (isCancelled) return;
      setParticipants(Array.from(lkRoom.remoteParticipants.values()));
    });

    lkRoom.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
      if (isCancelled) return;
      setParticipants(Array.from(lkRoom.remoteParticipants.values()));
      setActiveSpeakerIds(prev => {
        const next = new Set(prev);
        next.delete(p.identity);
        return next;
      });
    });

    lkRoom.on(RoomEvent.TrackSubscribed, () => {
      if (isCancelled) return;
      refreshTracks();
    });

    lkRoom.on(RoomEvent.TrackUnsubscribed, () => {
      if (isCancelled) return;
      refreshTracks();
    });

    lkRoom.on(RoomEvent.TrackMuted, () => {
      if (isCancelled) return;
      refreshTracks();
    });

    lkRoom.on(RoomEvent.TrackUnmuted, () => {
      if (isCancelled) return;
      refreshTracks();
    });

    lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      if (isCancelled) return;
      setActiveSpeakerIds(new Set(speakers.map(s => s.identity)));
    });

    lkRoom.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
      if (isCancelled) return;
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);
        if (data && data.text) {
          const newMsg: ChatMessage = {
            id: data.id || generateUUID(),
            senderName: data.senderName || participant?.name || participant?.identity || 'Remote User',
            senderIdentity: participant?.identity || 'remote',
            text: data.text,
            timestamp: data.timestamp || Date.now(),
            isLocal: false
          };
          setMessages(prev => [...prev, newMsg]);
          setIsChatOpen(open => {
            if (!open) {
              setUnreadChatCount(c => c + 1);
            }
            return open;
          });
        }
      } catch (err) {
        console.warn('Failed to parse incoming data message', err);
      }
    });

    lkRoom.on(RoomEvent.Disconnected, () => {
      if (isCancelled) return;
      setConnState(ConnectionState.Disconnected);
    });

    // Connect to room
    const connectToRoom = async () => {
      try {
        await lkRoom.connect(livekitUrl, token);
        if (isCancelled) return;

        // Publish local mic & camera
        if (initialAudio) {
          try {
            await lkRoom.localParticipant.setMicrophoneEnabled(
              true,
              selectedAudioDeviceId ? { deviceId: selectedAudioDeviceId } : undefined
            );
            setIsMicEnabled(true);
          } catch (micErr) {
            console.warn('Failed to enable mic on connect', micErr);
            setIsMicEnabled(false);
          }
        }

        if (initialVideo) {
          try {
            await lkRoom.localParticipant.setCameraEnabled(
              true,
              selectedVideoDeviceId ? { deviceId: selectedVideoDeviceId } : undefined
            );
            setIsVideoEnabled(true);

            const pub = lkRoom.localParticipant.getTrackPublication(Track.Source.Camera);
            if (pub?.track) {
              setLocalVideoTrack(pub.track);
            }
          } catch (camErr) {
            console.warn('Failed to enable camera on connect', camErr);
            setIsVideoEnabled(false);
          }
        }

        setParticipants(Array.from(lkRoom.remoteParticipants.values()));
      } catch (err: any) {
        console.error('LiveKit connection error:', err);
        if (!isCancelled) {
          setErrorMessage(err.message || 'Failed to connect to LiveKit server');
          setConnState(ConnectionState.Disconnected);
        }
      }
    };

    connectToRoom();

    return () => {
      isCancelled = true;
      lkRoom.disconnect();
    };
  }, [livekitUrl, token]);

  // Sync local video track
  useEffect(() => {
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    setLocalVideoTrack(pub?.track);
  }, [room, isVideoEnabled]);

  // Toggle Microphone
  const handleToggleMic = async () => {
    if (!room) return;
    try {
      const next = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setIsMicEnabled(next);
    } catch (err: any) {
      console.error('Error toggling mic', err);
    }
  };

  // Toggle Video
  const handleToggleVideo = async () => {
    if (!room) return;
    try {
      const next = !isVideoEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setIsVideoEnabled(next);
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      setLocalVideoTrack(pub?.track);
    } catch (err: any) {
      console.error('Error toggling video', err);
    }
  };

  // Flip Camera (Mobile front / rear)
  const handleFlipCamera = async () => {
    if (!room || !isVideoEnabled) return;
    try {
      const nextMode = facingMode === 'user' ? 'environment' : 'user';
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setCameraEnabled(true, {
        facingMode: nextMode
      });
      setFacingMode(nextMode);
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      setLocalVideoTrack(pub?.track);
    } catch (err) {
      console.warn('Failed to switch camera', err);
    }
  };

  // Cycle PiP position on tap
  const cyclePipPosition = () => {
    const positions: Array<'top-right' | 'bottom-right' | 'bottom-left' | 'top-left'> = [
      'top-right',
      'bottom-right',
      'bottom-left',
      'top-left'
    ];
    const currentIndex = positions.indexOf(pipPosition);
    setPipPosition(positions[(currentIndex + 1) % positions.length]);
  };

  // Send Chat Message
  const handleSendMessage = async (text: string) => {
    if (!room) return;
    const msg: ChatMessage = {
      id: generateUUID(),
      senderName: userName,
      senderIdentity: room.localParticipant.identity,
      text,
      timestamp: Date.now(),
      isLocal: true
    };

    setMessages(prev => [...prev, msg]);

    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          id: msg.id,
          senderName: msg.senderName,
          text: msg.text,
          timestamp: msg.timestamp
        })
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    } catch (err) {
      console.error('Failed to publish data message', err);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const primaryRemote = participants[0];

  return (
    <div className="mobile-active-call">
      {/* Full-bleed Remote Video Stage */}
      <div className="mobile-main-stage">
        {primaryRemote ? (
          (() => {
            const videoPub = primaryRemote.getTrackPublication(Track.Source.Camera);
            const audioPub = primaryRemote.getTrackPublication(Track.Source.Microphone);
            const isSpeaking = activeSpeakerIds.has(primaryRemote.identity);

            return (
              <VideoTile
                participant={primaryRemote}
                videoTrack={videoPub?.isSubscribed ? videoPub.track : undefined}
                audioTrack={audioPub?.isSubscribed ? audioPub.track : undefined}
                isLocal={false}
                isSpeaking={isSpeaking}
              />
            );
          })()
        ) : (
          /* Waiting for other participant screen */
          <div className="mobile-waiting-screen">
            <div className="mobile-waiting-avatar-pulse">
              <Users className="w-12 h-12 text-indigo-400 animate-pulse" />
            </div>
            <h3 className="mobile-waiting-title">Room {roomCode}</h3>
            <p className="mobile-waiting-subtitle">Waiting for other person to join...</p>

            <button
              onClick={handleCopyCode}
              className="mobile-share-code-btn"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 mr-1 text-emerald-400" /> Copied Code!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" /> Copy Room Code
                </>
              )}
            </button>
          </div>
        )}

        {/* Floating Local PiP Window */}
        {room && (
          <div
            className={`mobile-pip-window pip-pos-${pipPosition}`}
            onClick={cyclePipPosition}
            title="Tap to move preview"
          >
            <VideoTile
              participant={room.localParticipant}
              videoTrack={isVideoEnabled ? localVideoTrack : undefined}
              isLocal={true}
              isSpeaking={activeSpeakerIds.has(room.localParticipant.identity)}
            />

            {/* Quick Camera Flip button on PiP */}
            {isVideoEnabled && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleFlipCamera();
                }}
                className="pip-flip-btn"
                title="Flip Camera"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top Floating App Bar (Call info) */}
      <div className="mobile-call-top-bar">
        <div className="top-bar-left">
          <div className="call-code-pill" onClick={handleCopyCode}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono">{roomCode}</span>
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        <div className="top-bar-center">
          <span className="call-active-time">{formatTime(elapsedSeconds)}</span>
        </div>

        <div className="top-bar-right">
          <span className="live-status-dot" />
        </div>
      </div>

      {/* Connection error toast */}
      {errorMessage && (
        <div className="mobile-call-error">
          <AlertTriangle className="w-4 h-4 text-amber-400 mr-2" />
          <span>{errorMessage}</span>
          <button onClick={onLeave} className="ml-2 text-xs underline">
            Exit
          </button>
        </div>
      )}

      {/* In-Call Chat Sheet (Native Mobile Bottom Sheet) */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
      />

      {/* Floating Bottom Control Dock */}
      <div className="mobile-bottom-dock">
        {/* Flip Camera */}
        <button
          onClick={handleFlipCamera}
          className="dock-circle-btn"
          title="Flip Camera"
        >
          <SwitchCamera className="w-6 h-6 text-white" />
        </button>

        {/* Video Toggle */}
        <button
          onClick={handleToggleVideo}
          className={`dock-circle-btn ${!isVideoEnabled ? 'btn-danger-state' : ''}`}
          title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isVideoEnabled ? (
            <VideoIcon className="w-6 h-6 text-white" />
          ) : (
            <VideoOff className="w-6 h-6 text-white" />
          )}
        </button>

        {/* Mic Toggle */}
        <button
          onClick={handleToggleMic}
          className={`dock-circle-btn ${!isMicEnabled ? 'btn-danger-state' : ''}`}
          title={isMicEnabled ? 'Mute Mic' : 'Unmute Mic'}
        >
          {isMicEnabled ? (
            <Mic className="w-6 h-6 text-white" />
          ) : (
            <MicOff className="w-6 h-6 text-white" />
          )}
        </button>

        {/* Chat Drawer Toggle */}
        <button
          onClick={() => {
            setIsChatOpen(!isChatOpen);
            setUnreadChatCount(0);
          }}
          className={`dock-circle-btn ${isChatOpen ? 'btn-active-state' : ''}`}
          title="In-call Chat"
        >
          <MessageSquare className="w-6 h-6 text-white" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="dock-chat-badge">{unreadChatCount}</span>
          )}
        </button>

        {/* Big Red Hang Up Button */}
        <button
          onClick={onLeave}
          className="dock-hangup-btn"
          title="End Call"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
};
