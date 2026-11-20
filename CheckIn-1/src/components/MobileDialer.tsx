import React, { useState, useEffect } from 'react';
import {
  Phone,
  Delete,
  Sparkles,
  Clipboard,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  Clock,
  Grid,
  Keyboard,
  User,
  Check
} from 'lucide-react';
import { generateRoomCode } from '../utils/uuid';
import type { LiveKitConfig } from '../types';

interface MobileDialerProps {
  onCall: (params: {
    roomCode: string;
    userName: string;
    initialVideo: boolean;
    initialAudio: boolean;
  }) => void;
  onOpenSettings: () => void;
  config: LiveKitConfig;
  initialRoomCode?: string;
}

export const MobileDialer: React.FC<MobileDialerProps> = ({
  onCall,
  onOpenSettings,
  config,
  initialRoomCode = ''
}) => {
  const [activeTab, setActiveTab] = useState<'dialer' | 'recents'>('dialer');
  const [roomCode, setRoomCode] = useState(() => initialRoomCode || '');
  const [userName, setUserName] = useState(
    () => localStorage.getItem('checkin_user_name') || ''
  );
  const [isEditingName, setIsEditingName] = useState(false);

  // Pre-call toggles
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Recents call history
  const [recents, setRecents] = useState<
    Array<{ code: string; timestamp: number; name?: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('checkin_call_recents');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [copiedNotification, setCopiedNotification] = useState(false);
  const [showSoftKeyboard, setShowSoftKeyboard] = useState(false);

  // Time for status bar
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Dial pad buttons mapping
  const dialKeys = [
    { num: '1', sub: '·' },
    { num: '2', sub: 'ABC' },
    { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' },
    { num: '5', sub: 'JKL' },
    { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' },
    { num: '8', sub: 'TUV' },
    { num: '9', sub: 'WXYZ' },
    { num: '*', sub: 'AUTO' },
    { num: '0', sub: '+' },
    { num: '#', sub: 'PASTE' }
  ];

  const handleKeyPress = (num: string) => {
    if (num === '*') {
      // Auto-generate fresh 6-char code
      const code = generateRoomCode();
      setRoomCode(code);
      return;
    }

    if (num === '#') {
      handlePaste();
      return;
    }

    if (roomCode.length < 10) {
      setRoomCode(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setRoomCode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setRoomCode('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
        if (clean) {
          setRoomCode(clean);
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleCall = (overrideCode?: string) => {
    const targetCode = (overrideCode || roomCode).trim().toUpperCase();
    if (!targetCode) return;

    const finalName = userName.trim() || `User_${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem('checkin_user_name', finalName);

    // Save to recents
    const newEntry = { code: targetCode, timestamp: Date.now(), name: finalName };
    const updatedRecents = [newEntry, ...recents.filter(r => r.code !== targetCode)].slice(0, 10);
    setRecents(updatedRecents);
    localStorage.setItem('checkin_call_recents', JSON.stringify(updatedRecents));

    onCall({
      roomCode: targetCode,
      userName: finalName,
      initialAudio: audioEnabled,
      initialVideo: videoEnabled
    });
  };

  return (
    <div className="mobile-shell">
      {/* Mobile Top Status Bar */}
      <div className="mobile-status-bar">
        <span className="status-bar-time">{currentTime || '09:41'}</span>
        <div className="status-bar-icons">
          <span className="status-signal-bars">
            <span className="bar b1" />
            <span className="bar b2" />
            <span className="bar b3" />
            <span className="bar b4" />
          </span>
          <span className="status-wifi">5G</span>
          <span className="status-battery">
            <span className="battery-level" />
          </span>
        </div>
      </div>

      {/* App Header */}
      <div className="mobile-app-header">
        <div className="user-profile-badge">
          <div className="user-avatar-mini">
            <User className="w-4 h-4 text-indigo-300" />
          </div>
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              className="user-name-inline-input"
              value={userName}
              placeholder="Your name"
              onBlur={() => setIsEditingName(false)}
              onChange={e => setUserName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
            />
          ) : (
            <div
              className="user-name-display"
              onClick={() => setIsEditingName(true)}
              title="Click to change your display name"
            >
              <span>{userName || 'Set Your Name'}</span>
              <span className="edit-pill">edit</span>
            </div>
          )}
        </div>

        <button
          onClick={onOpenSettings}
          className="header-icon-btn"
          title="LiveKit Connection Settings"
        >
          <Settings className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      {/* Main Screen Content */}
      <div className="mobile-body-content">
        {activeTab === 'dialer' ? (
          <div className="dialer-container">
            {/* Room Code Display Screen */}
            <div className="dialer-display">
              <span className="dialer-label">ENTER ROOM CODE</span>

              <div className="dialer-input-row">
                <input
                  type="text"
                  readOnly={!showSoftKeyboard}
                  value={roomCode}
                  placeholder="------"
                  onChange={e =>
                    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                  }
                  className={`dialer-code-text ${
                    showSoftKeyboard ? 'manual-input-active' : ''
                  }`}
                />

                {roomCode.length > 0 && (
                  <button
                    onClick={handleBackspace}
                    onDoubleClick={handleClear}
                    className="dialer-backspace-btn"
                    title="Backspace"
                  >
                    <Delete className="w-6 h-6 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Quick Actions Under Display */}
              <div className="display-quick-actions">
                <button
                  type="button"
                  onClick={() => handleKeyPress('*')}
                  className="quick-action-pill"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-400" /> Auto-Gen Code
                </button>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="quick-action-pill"
                >
                  <Clipboard className="w-3.5 h-3.5 mr-1 text-slate-400" /> Paste
                </button>
                <button
                  type="button"
                  onClick={() => setShowSoftKeyboard(!showSoftKeyboard)}
                  className={`quick-action-pill ${showSoftKeyboard ? 'active' : ''}`}
                >
                  <Keyboard className="w-3.5 h-3.5 mr-1 text-slate-400" />{' '}
                  {showSoftKeyboard ? 'Dialpad' : 'Keyboard'}
                </button>
              </div>
            </div>

            {/* Circular Keypad Grid */}
            <div className="dialpad-grid">
              {dialKeys.map(k => (
                <button
                  key={k.num}
                  type="button"
                  onClick={() => handleKeyPress(k.num)}
                  className="dialpad-key"
                >
                  <span className="key-number">{k.num}</span>
                  <span className="key-subtext">{k.sub}</span>
                </button>
              ))}
            </div>

            {/* Call Action Bar */}
            <div className="dialer-call-bar">
              {/* Pre-call Mic Toggle */}
              <button
                type="button"
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`side-action-circle ${
                  audioEnabled ? 'active-state' : 'muted-state'
                }`}
                title={audioEnabled ? 'Microphone On' : 'Microphone Muted'}
              >
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* Huge Green Call Button */}
              <button
                type="button"
                disabled={!roomCode.trim()}
                onClick={() => handleCall()}
                className="main-call-btn"
                title="Start Video Call"
              >
                <Phone className="w-8 h-8 text-white fill-current" />
              </button>

              {/* Pre-call Camera Toggle */}
              <button
                type="button"
                onClick={() => setVideoEnabled(!videoEnabled)}
                className={`side-action-circle ${
                  videoEnabled ? 'active-state' : 'muted-state'
                }`}
                title={videoEnabled ? 'Camera On' : 'Camera Off'}
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>
          </div>
        ) : (
          /* Recents History Screen */
          <div className="recents-container">
            <h2 className="recents-title">Recent Calls</h2>
            {recents.length === 0 ? (
              <div className="recents-empty">
                <Clock className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">No recent calls</p>
                <p className="text-slate-500 text-xs mt-1">
                  Calls you join will appear here for fast 1-tap redial.
                </p>
              </div>
            ) : (
              <div className="recents-list">
                {recents.map(r => {
                  const date = new Date(r.timestamp);
                  const timeFormatted = date.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={r.code + r.timestamp} className="recent-item">
                      <div className="recent-info">
                        <span className="recent-code">{r.code}</span>
                        <span className="recent-time">{timeFormatted}</span>
                      </div>
                      <button
                        onClick={() => handleCall(r.code)}
                        className="recent-call-btn"
                        title="Call this room"
                      >
                        <Phone className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Tabs */}
      <div className="mobile-bottom-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('dialer')}
          className={`tab-btn ${activeTab === 'dialer' ? 'active-tab' : ''}`}
        >
          <Grid className="w-5 h-5" />
          <span>Keypad</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recents')}
          className={`tab-btn ${activeTab === 'recents' ? 'active-tab' : ''}`}
        >
          <Clock className="w-5 h-5" />
          <span>Recents</span>
        </button>
      </div>
    </div>
  );
};
