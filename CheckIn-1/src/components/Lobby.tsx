import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Sparkles,
  Clipboard,
  PhoneCall,
  Camera,
  RefreshCw
} from 'lucide-react';
import { generateRoomCode } from '../utils/uuid';
import type { DeviceInfo, LiveKitConfig } from '../types';

interface LobbyProps {
  onJoin: (params: {
    roomCode: string;
    userName: string;
    initialVideo: boolean;
    initialAudio: boolean;
    selectedVideoDeviceId?: string;
    selectedAudioDeviceId?: string;
  }) => void;
  onOpenSettings: () => void;
  config: LiveKitConfig;
  initialRoomCode?: string;
  isConnecting?: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({
  onJoin,
  onOpenSettings,
  config,
  initialRoomCode = '',
  isConnecting = false
}) => {
  const [roomCode, setRoomCode] = useState(
    () => initialRoomCode || localStorage.getItem('checkin_last_room') || ''
  );
  const [userName, setUserName] = useState(
    () => localStorage.getItem('checkin_user_name') || ''
  );

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const [videoDevices, setVideoDevices] = useState<DeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<DeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');

  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Auto-generate code if empty
  useEffect(() => {
    if (!roomCode) {
      setRoomCode(generateRoomCode());
    }
  }, []);

  // Enumerate devices
  const refreshDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();

      const vDevs: DeviceInfo[] = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`
        }));

      const aDevs: DeviceInfo[] = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`
        }));

      setVideoDevices(vDevs);
      setAudioDevices(aDevs);

      if (vDevs.length > 0 && !selectedVideoDeviceId) {
        setSelectedVideoDeviceId(vDevs[0].deviceId);
      }
      if (aDevs.length > 0 && !selectedAudioDeviceId) {
        setSelectedAudioDeviceId(aDevs[0].deviceId);
      }
    } catch (err) {
      console.warn('Device enumeration failed', err);
    }
  };

  // Start media stream for preview
  const startPreview = async () => {
    try {
      // Stop old tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      if (!videoEnabled && !audioEnabled) {
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = null;
        }
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: videoEnabled
          ? selectedVideoDeviceId
            ? { deviceId: { exact: selectedVideoDeviceId } }
            : true
          : false,
        audio: audioEnabled
          ? selectedAudioDeviceId
            ? { deviceId: { exact: selectedAudioDeviceId } }
            : true
          : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      // Audio meter
      if (audioEnabled && stream.getAudioTracks().length > 0) {
        try {
          const AudioContextClass =
            window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const checkLevel = () => {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(checkLevel);
            };
            checkLevel();
          }
        } catch (e) {
          console.warn('Audio meter init error:', e);
        }
      } else {
        setAudioLevel(0);
      }

      await refreshDevices();
    } catch (err) {
      console.warn('Preview stream error:', err);
    }
  };

  useEffect(() => {
    startPreview();
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [videoEnabled, audioEnabled, selectedVideoDeviceId, selectedAudioDeviceId]);

  const handleGenerateCode = () => {
    const code = generateRoomCode();
    setRoomCode(code);
  };

  const handlePasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = text.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
        setRoomCode(clean);
      }
    } catch {
      // Ignore clipboard permission issue
    }
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;

    const finalName = userName.trim() || `User_${Math.floor(100 + Math.random() * 900)}`;

    localStorage.setItem('checkin_last_room', cleanCode);
    localStorage.setItem('checkin_user_name', finalName);

    // Stop preview stream before handoff to LiveKit
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }

    onJoin({
      roomCode: cleanCode,
      userName: finalName,
      initialVideo: videoEnabled,
      initialAudio: audioEnabled,
      selectedVideoDeviceId,
      selectedAudioDeviceId
    });
  };

  return (
    <div className="lobby-wrapper">
      {/* Top Navbar */}
      <header className="lobby-nav">
        <div className="lobby-brand">
          <div className="brand-logo-glow">
            <Video className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="brand-title">CheckIn</h1>
            <p className="brand-subtitle">WebRTC Video Calls powered by LiveKit</p>
          </div>
        </div>

        <div className="lobby-nav-actions">
          <button
            onClick={onOpenSettings}
            className="icon-btn-secondary"
            title="Configure LiveKit Credentials"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            <span className="hidden-sm">LiveKit Config</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="lobby-content">
        <div className="lobby-grid">
          {/* Left Column: Media Preview */}
          <div className="preview-card">
            <div className="preview-container">
              <video
                ref={previewVideoRef}
                autoPlay
                playsInline
                muted
                className={`preview-video ${!videoEnabled ? 'hidden' : ''}`}
              />

              {!videoEnabled && (
                <div className="preview-off-screen">
                  <VideoOff className="w-14 h-14 text-slate-500 mb-2" />
                  <p className="text-slate-400 text-sm font-medium">Camera is turned off</p>
                </div>
              )}

              {/* Floating Quick Toggles */}
              <div className="preview-floating-controls">
                <button
                  type="button"
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`preview-toggle-btn ${
                    audioEnabled ? 'btn-active-mic' : 'btn-muted-mic'
                  }`}
                  title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  className={`preview-toggle-btn ${
                    videoEnabled ? 'btn-active-cam' : 'btn-muted-cam'
                  }`}
                  title={videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>

              {/* Live Audio Level Meter */}
              {audioEnabled && (
                <div className="audio-meter-bar" title="Microphone Level">
                  <div
                    className="audio-meter-fill"
                    style={{ width: `${Math.max(5, audioLevel)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Device Selectors */}
            <div className="device-selectors-box">
              {videoDevices.length > 1 && (
                <div className="selector-group">
                  <label className="text-xs text-slate-400 flex items-center mb-1">
                    <Camera className="w-3.5 h-3.5 mr-1" /> Camera
                  </label>
                  <select
                    value={selectedVideoDeviceId}
                    onChange={e => setSelectedVideoDeviceId(e.target.value)}
                    className="form-select text-xs"
                  >
                    {videoDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {audioDevices.length > 1 && (
                <div className="selector-group">
                  <label className="text-xs text-slate-400 flex items-center mb-1">
                    <Mic className="w-3.5 h-3.5 mr-1" /> Microphone
                  </label>
                  <select
                    value={selectedAudioDeviceId}
                    onChange={e => setSelectedAudioDeviceId(e.target.value)}
                    className="form-select text-xs"
                  >
                    {audioDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Join Form */}
          <div className="lobby-form-card">
            <div className="form-card-header">
              <h2 className="text-xl font-bold text-white">Join or Start a Call</h2>
              <p className="text-sm text-slate-400 mt-1">
                Enter a room code to call another person. If you share this code, they can join instantly!
              </p>
            </div>

            <form onSubmit={handleSubmit} className="lobby-form">
              {/* Room Code Field */}
              <div className="form-group">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="form-label mb-0">Room Code</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      className="btn-tiny-link"
                      title="Generate new 6-character code"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> Generate
                    </button>
                    <button
                      type="button"
                      onClick={handlePasteCode}
                      className="btn-tiny-link"
                      title="Paste from clipboard"
                    >
                      <Clipboard className="w-3.5 h-3.5 mr-1" /> Paste
                    </button>
                  </div>
                </div>

                <div className="room-input-container">
                  <input
                    type="text"
                    required
                    maxLength={14}
                    placeholder="e.g. AZ49XP"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    className="room-code-input"
                  />
                  {roomCode && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="room-copy-btn"
                      title="Copy room code"
                    >
                      {copiedCode ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                <span className="field-hint">
                  Both participants must enter the same code to connect.
                </span>
              </div>

              {/* Your Name */}
              <div className="form-group">
                <label className="form-label">Your Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alice"
                  value={userName}
                  onChange={e => setUserName(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Join Button */}
              <button
                type="submit"
                disabled={!roomCode.trim() || isConnecting}
                className="btn-primary-large"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Connecting to Call...
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-5 h-5 mr-2" />
                    Join Call
                  </>
                )}
              </button>
            </form>

            <div className="lobby-footer-note">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />
              <span>Direct P2P / SFU WebRTC with LiveKit</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
