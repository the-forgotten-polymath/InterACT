import React, { useState } from 'react';
import { MobileDialer } from './components/MobileDialer';
import { CallingScreen } from './components/CallingScreen';
import { ActiveCall } from './components/ActiveCall';
import { SettingsModal } from './components/SettingsModal';
import { getLiveKitToken } from './token';
import { generateUUID } from './utils/uuid';
import type { LiveKitConfig } from './types';

export const App: React.FC = () => {
  // Query param auto-fill
  const [initialRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  });

  // Settings / config
  const [config, setConfig] = useState<LiveKitConfig>(() => {
    const saved = localStorage.getItem('checkin_livekit_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      livekitUrl: (import.meta as any).env?.VITE_LIVEKIT_URL || '',
      apiKey: '',
      apiSecret: '',
      token: ''
    };
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appState, setAppState] = useState<'dialer' | 'calling' | 'active'>('dialer');

  const [pendingCall, setPendingCall] = useState<{
    roomCode: string;
    userName: string;
    initialVideo: boolean;
    initialAudio: boolean;
  } | null>(null);

  const [callParams, setCallParams] = useState<{
    roomCode: string;
    userName: string;
    token: string;
    livekitUrl: string;
    initialVideo: boolean;
    initialAudio: boolean;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveConfig = (newConfig: LiveKitConfig) => {
    setConfig(newConfig);
    localStorage.setItem('checkin_livekit_config', JSON.stringify(newConfig));
  };

  const handleInitiateCall = async (params: {
    roomCode: string;
    userName: string;
    initialVideo: boolean;
    initialAudio: boolean;
  }) => {
    setPendingCall(params);
    setAppState('calling');
    setErrorMessage(null);

    const identity = `user_${generateUUID().substring(0, 8)}`;

    try {
      // Simulate realistic call connection / ring phase
      const [result] = await Promise.all([
        getLiveKitToken(params.roomCode, identity, params.userName, config),
        new Promise(resolve => setTimeout(resolve, 1200)) // brief ring feel
      ]);

      setCallParams({
        roomCode: params.roomCode,
        userName: params.userName,
        token: result.token,
        livekitUrl: result.livekitUrl || config.livekitUrl,
        initialVideo: params.initialVideo,
        initialAudio: params.initialAudio
      });
      setAppState('active');
    } catch (err: any) {
      console.error('Call connection error:', err);
      const errMsg = err.message || 'Failed to authenticate with LiveKit';
      setErrorMessage(errMsg);
      setAppState('dialer');
      setPendingCall(null);

      if (
        errMsg.includes('not configured') ||
        errMsg.includes('LIVEKIT_API_KEY') ||
        !config.livekitUrl
      ) {
        setIsSettingsOpen(true);
      }
    }
  };

  const handleCancelCall = () => {
    setAppState('dialer');
    setPendingCall(null);
  };

  const handleEndCall = () => {
    setAppState('dialer');
    setCallParams(null);
    setPendingCall(null);
  };

  return (
    <div className="mobile-app-viewport">
      {errorMessage && (
        <div className="global-toast-error">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="toast-dismiss">
            ×
          </button>
        </div>
      )}

      {/* Screen Router */}
      {appState === 'dialer' && (
        <MobileDialer
          onCall={handleInitiateCall}
          onOpenSettings={() => setIsSettingsOpen(true)}
          config={config}
          initialRoomCode={initialRoomCode}
        />
      )}

      {appState === 'calling' && pendingCall && (
        <CallingScreen
          roomCode={pendingCall.roomCode}
          userName={pendingCall.userName}
          onCancel={handleCancelCall}
        />
      )}

      {appState === 'active' && callParams && (
        <ActiveCall
          roomCode={callParams.roomCode}
          userName={callParams.userName}
          token={callParams.token}
          livekitUrl={callParams.livekitUrl}
          initialVideo={callParams.initialVideo}
          initialAudio={callParams.initialAudio}
          onLeave={handleEndCall}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={handleSaveConfig}
      />
    </div>
  );
};
export default App;
