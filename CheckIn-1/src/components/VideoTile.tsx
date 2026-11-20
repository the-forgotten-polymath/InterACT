import React, { useEffect, useRef, useState } from 'react';
import type { Participant, Track, RemoteTrack } from 'livekit-client';
import { Mic, MicOff, Maximize2, Minimize2, Monitor, User } from 'lucide-react';

interface VideoTileProps {
  participant: Participant;
  videoTrack?: Track;
  audioTrack?: Track;
  isLocal?: boolean;
  isScreenShare?: boolean;
  isSpeaking?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  videoTrack,
  audioTrack,
  isLocal = false,
  isScreenShare = false,
  isSpeaking = false,
  pinned = false,
  onTogglePin
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  // Attach video track
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (videoTrack) {
      videoTrack.attach(el);
      setHasVideo(true);

      return () => {
        videoTrack.detach(el);
        setHasVideo(false);
      };
    } else {
      setHasVideo(false);
    }
  }, [videoTrack]);

  // Attach audio track for remote participants
  useEffect(() => {
    const el = audioRef.current;
    if (!el || isLocal) return;

    if (audioTrack) {
      (audioTrack as RemoteTrack).attach(el);
      return () => {
        (audioTrack as RemoteTrack).detach(el);
      };
    }
  }, [audioTrack, isLocal]);

  const name = participant.name || participant.identity || (isLocal ? 'You' : 'Remote');
  const isMicMuted = !participant.isMicrophoneEnabled;
  const initials = name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div
      className={`video-tile ${isSpeaking ? 'speaking-active' : ''} ${
        pinned ? 'pinned-tile' : ''
      } ${isScreenShare ? 'screenshare-tile' : ''}`}
    >
      {/* Remote Audio */}
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Video Stream Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`video-element ${isLocal && !isScreenShare ? 'mirrored' : ''} ${
          !hasVideo ? 'hidden' : ''
        }`}
      />

      {/* Video Off / Camera Placeholder */}
      {!hasVideo && (
        <div className="avatar-placeholder">
          <div className={`avatar-circle ${isSpeaking ? 'avatar-pulse' : ''}`}>
            {isScreenShare ? (
              <Monitor className="w-12 h-12 text-slate-300" />
            ) : (
              <span className="avatar-initials">{initials}</span>
            )}
          </div>
          <p className="avatar-name">
            {name} {isLocal && '(You)'}
          </p>
          <span className="camera-off-tag">Camera Off</span>
        </div>
      )}

      {/* Badges Overlay */}
      <div className="tile-overlay-bottom">
        <div className="participant-badge">
          {isMicMuted ? (
            <span className="mic-badge-muted" title="Muted">
              <MicOff className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span
              className={`mic-badge-live ${isSpeaking ? 'mic-speaking' : ''}`}
              title="Active"
            >
              <Mic className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="participant-name-text">
            {name} {isLocal && <span className="opacity-75">(You)</span>}
            {isScreenShare && <span className="screenshare-tag">Screen</span>}
          </span>
        </div>

        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className="pin-btn"
            title={pinned ? 'Unpin view' : 'Pin to focus'}
          >
            {pinned ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Speaking Glow Ring */}
      {isSpeaking && <div className="speaking-glow-border" />}
    </div>
  );
};
