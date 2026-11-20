import React, { useEffect, useState } from 'react';
import { PhoneOff, User, Wifi, ShieldCheck, Sparkles } from 'lucide-react';

interface CallingScreenProps {
  roomCode: string;
  userName: string;
  onCancel: () => void;
}

export const CallingScreen: React.FC<CallingScreenProps> = ({
  roomCode,
  userName,
  onCancel
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="calling-screen-overlay">
      {/* Background radial glow */}
      <div className="calling-ambient-glow" />

      {/* Top Header */}
      <div className="calling-header">
        <div className="calling-shield-badge">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1" />
          <span>Encrypted WebRTC Call</span>
        </div>
      </div>

      {/* Center Calling Info */}
      <div className="calling-center-info">
        {/* Pulsing Sonar Rings around Avatar */}
        <div className="calling-avatar-wrapper">
          <div className="calling-sonar-ring r1" />
          <div className="calling-sonar-ring r2" />
          <div className="calling-sonar-ring r3" />

          <div className="calling-avatar-circle">
            <span className="calling-avatar-code">{roomCode.slice(0, 2)}</span>
          </div>
        </div>

        <h2 className="calling-title">Room {roomCode}</h2>
        <p className="calling-status-text">
          Calling{dots}
        </p>

        <div className="calling-meta-box">
          <span className="calling-user-tag">As {userName}</span>
        </div>
      </div>

      {/* Bottom Cancel Action */}
      <div className="calling-bottom-bar">
        <button
          onClick={onCancel}
          className="calling-hangup-btn"
          title="Cancel Call"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
        <span className="hangup-label">Cancel</span>
      </div>
    </div>
  );
};
