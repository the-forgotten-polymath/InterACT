import React, { useState, useEffect, useRef } from 'react';
import {
  Hand,
  Camera,
  CameraOff,
  Sparkles,
  Check,
  X,
  Trash2,
  Plus,
  Minimize2,
  Maximize2,
  ShieldCheck,
  Activity,
  AlertCircle
} from 'lucide-react';
import {
  GestureService,
  EnrolledGesture,
  DEFAULT_PRESET_GESTURES,
  MatchResult,
  Landmark3D
} from '../services/gesture';

interface GestureHUDModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGestureConfirmed: (gesture: EnrolledGesture) => void;
  onActivityChange?: (activity: string) => void;
}

export const GestureHUDModal: React.FC<GestureHUDModalProps> = ({
  isOpen,
  onClose,
  onGestureConfirmed,
  onActivityChange
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'detector' | 'enroll' | 'library'>('detector');
  const [isMinimized, setIsMinimized] = useState(false);

  // Live detection state
  const [detectedGesture, setDetectedGesture] = useState<MatchResult | null>(null);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%
  const [lastTriggeredPhrase, setLastTriggeredPhrase] = useState<string | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  // Custom Enrollment state
  const [customName, setCustomName] = useState('');
  const [customPhrase, setCustomPhrase] = useState('');
  const [customEmoji, setCustomEmoji] = useState('✨');
  const [enrollmentCountdown, setEnrollmentCountdown] = useState<number | null>(null);
  const [enrolledVector, setEnrolledVector] = useState<number[] | null>(null);
  const [customList, setCustomList] = useState<EnrolledGesture[]>(() =>
    GestureService.getCustomGestures()
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);
  const currentMatchRef = useRef<MatchResult | null>(null);

  const HOLD_DURATION_MS = 1200; // 1.2 seconds required hold

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraActive(true);
          initAndRunDetection();
        };
      }
    } catch (err: any) {
      console.error('[GestureHUD] Camera start failed:', err);
      setCameraError(err.message || 'Camera permission denied or camera unavailable');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setDetectedGesture(null);
    setHoldProgress(0);
    holdStartTimeRef.current = null;
  };

  // Run MediaPipe continuous vision loop
  const initAndRunDetection = async () => {
    try {
      const landmarker = await GestureService.initLandmarker();
      processVideoFrame(landmarker);
    } catch (err) {
      console.error('[GestureHUD] Landmarker initialization error:', err);
      setCameraError('Failed to initialize local AI Vision model.');
    }
  };

  const processVideoFrame = (landmarker: any) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) {
      animFrameRef.current = requestAnimationFrame(() => processVideoFrame(landmarker));
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Run landmarker on current video frame
    const startTimeMs = performance.now();
    let results: any = null;
    try {
      results = landmarker.detectForVideo(video, startTimeMs);
    } catch (e) {
      // Ignore occasional frame dropped errors
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results && results.landmarks && results.landmarks.length > 0) {
      const rawLandmarks: Landmark3D[] = results.landmarks[0];

      // Draw hand skeleton on overlay canvas
      drawSkeleton(ctx, rawLandmarks, canvas.width, canvas.height);

      // Evaluate match against presets and enrolled custom gestures
      const matched =
        GestureService.matchPresetGesture(rawLandmarks) ||
        GestureService.matchCustomGestures(rawLandmarks);

      handleMatchHoldLogic(matched);

      // If user is enrolling, capture live sample vector
      if (enrollmentCountdown !== null && enrollmentCountdown <= 1) {
        const norm = GestureService.normalizeLandmarks(rawLandmarks);
        if (norm.length > 0) {
          setEnrolledVector(norm);
        }
      }
    } else {
      handleMatchHoldLogic(null);
    }

    animFrameRef.current = requestAnimationFrame(() => processVideoFrame(landmarker));
  };

  // Draw 21 keypoints and bones
  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark3D[],
    w: number,
    h: number
  ) => {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16],// Ring
      [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
      [5, 9], [9, 13], [13, 17]             // Palm
    ];

    // Draw connecting bones
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#6366f1';
    for (const [startIdx, endIdx] of connections) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      ctx.beginPath();
      // Mirror horizontally because webcam is mirrored
      ctx.moveTo(w - p1.x * w, p1.y * h);
      ctx.lineTo(w - p2.x * w, p2.y * h);
      ctx.stroke();
    }

    // Draw joints
    for (const p of landmarks) {
      ctx.beginPath();
      ctx.arc(w - p.x * w, p.y * h, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  // Handle temporal stability hold gate (1.2s steady hold before dispatching)
  const handleMatchHoldLogic = (match: MatchResult | null) => {
    if (isCoolingDown) return;

    if (!match) {
      holdStartTimeRef.current = null;
      currentMatchRef.current = null;
      setDetectedGesture(null);
      setHoldProgress(0);
      return;
    }

    // If new gesture detected
    if (!currentMatchRef.current || currentMatchRef.current.gesture.id !== match.gesture.id) {
      currentMatchRef.current = match;
      holdStartTimeRef.current = performance.now();
      setDetectedGesture(match);
      setHoldProgress(0);
      onActivityChange?.('gesturing');
      return;
    }

    // Same gesture held steadily
    if (holdStartTimeRef.current) {
      const elapsed = performance.now() - holdStartTimeRef.current;
      const progress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
      setHoldProgress(progress);

      if (elapsed >= HOLD_DURATION_MS) {
        // Trigger confirmed!
        triggerGestureConfirmation(match.gesture);
      }
    }
  };

  const triggerGestureConfirmation = (gesture: EnrolledGesture) => {
    holdStartTimeRef.current = null;
    currentMatchRef.current = null;
    setDetectedGesture(null);
    setHoldProgress(0);
    setIsCoolingDown(true);
    setLastTriggeredPhrase(gesture.phrase);

    // Audio chime trigger
    playConfirmationChime();

    // Send phrase to live session
    onGestureConfirmed(gesture);

    // Cooldown 2.5s before allowing next gesture trigger
    setTimeout(() => {
      setIsCoolingDown(false);
      setLastTriggeredPhrase(null);
      onActivityChange?.('idle');
    }, 2500);
  };

  const playConfirmationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext unavailable
    }
  };

  // Start enrollment capture countdown
  const handleStartEnrollment = () => {
    if (!customName.trim() || !customPhrase.trim()) {
      alert('Please provide both a gesture name and spoken phrase.');
      return;
    }

    setEnrolledVector(null);
    setEnrollmentCountdown(3);

    const timer = setInterval(() => {
      setEnrollmentCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSaveCustomGesture = () => {
    if (!enrolledVector) {
      alert('No hand pose captured yet. Hold your hand pose steady in front of the camera and click Record.');
      return;
    }

    const saved = GestureService.saveCustomGesture({
      name: customName.trim(),
      phrase: customPhrase.trim(),
      emoji: customEmoji || '✨',
      vector: enrolledVector
    });

    setCustomList(GestureService.getCustomGestures());
    setCustomName('');
    setCustomPhrase('');
    setEnrolledVector(null);
    setEnrollmentCountdown(null);
    setActiveTab('detector');
  };

  const handleDeleteCustom = (id: string) => {
    GestureService.deleteCustomGesture(id);
    setCustomList(GestureService.getCustomGestures());
  };

  if (!isOpen) return null;

  // Minimized Floating HUD
  if (isMinimized) {
    return (
      <div className="gesture-pip-container">
        <div className="gesture-pip-header">
          <div className="pip-title">
            <Hand size={14} className="text-emerald" />
            <span>Gesture HUD</span>
          </div>
          <button onClick={() => setIsMinimized(false)} className="btn-icon-xs" title="Expand HUD">
            <Maximize2 size={12} />
          </button>
        </div>

        <div className="pip-video-wrap">
          <video ref={videoRef} autoPlay playsInline muted className="pip-video mirrored" />
          <canvas ref={canvasRef} className="pip-canvas" />

          {detectedGesture && (
            <div className="pip-badge">
              <span>{detectedGesture.gesture.emoji} {detectedGesture.gesture.name}</span>
              <div className="pip-progress-bar" style={{ width: `${holdProgress}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="gesture-modal-card">
        {/* Header */}
        <div className="gesture-modal-header">
          <div className="header-title">
            <div className="gesture-icon-badge">
              <Hand size={22} className="text-primary-indigo" />
            </div>
            <div>
              <h3>Personalized Gesture Macros</h3>
              <p>Hands-free visual communication. 100% processed locally on device for privacy.</p>
            </div>
          </div>

          <div className="modal-header-actions">
            <button
              onClick={() => setIsMinimized(true)}
              className="btn-icon"
              title="Minimize to Floating Camera"
            >
              <Minimize2 size={18} />
            </button>
            <button onClick={onClose} className="btn-close" title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="gesture-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('detector')}
            className={`tab-btn ${activeTab === 'detector' ? 'active' : ''}`}
          >
            <Camera size={14} className="mr-1" /> Live Gesture Camera
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enroll')}
            className={`tab-btn ${activeTab === 'enroll' ? 'active' : ''}`}
          >
            <Plus size={14} className="mr-1" /> Enroll Custom Macro
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`tab-btn ${activeTab === 'library' ? 'active' : ''}`}
          >
            <Hand size={14} className="mr-1" /> Macro Library ({DEFAULT_PRESET_GESTURES.length + customList.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="gesture-modal-content">
          {cameraError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              <span>{cameraError}</span>
            </div>
          )}

          {activeTab === 'detector' && (
            <div className="detector-layout">
              {/* Camera Preview with Overlay Canvas */}
              <div className="video-viewport">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video mirrored"
                />
                <canvas ref={canvasRef} className="camera-canvas" />

                {/* HUD Live Detection Overlay */}
                {detectedGesture && (
                  <div className="live-hud-pill">
                    <div className="hud-pill-info">
                      <span className="hud-emoji">{detectedGesture.gesture.emoji}</span>
                      <div>
                        <strong>{detectedGesture.gesture.name}</strong>
                        <span className="confidence-tag">
                          {Math.round(detectedGesture.confidence * 100)}% match
                        </span>
                      </div>
                    </div>
                    <div className="hud-phrase-preview">"{detectedGesture.gesture.phrase}"</div>
                    {/* Hold Progress Bar */}
                    <div className="hold-progress-track">
                      <div className="hold-progress-fill" style={{ width: `${holdProgress}%` }} />
                    </div>
                    <span className="hold-hint">Hold steady for 1.2s to speak to agent...</span>
                  </div>
                )}

                {/* Confirmed Broadcast Notice */}
                {lastTriggeredPhrase && (
                  <div className="confirmed-flash-banner">
                    <Check size={20} className="text-emerald" />
                    <span>Transmitted: "{lastTriggeredPhrase}"</span>
                  </div>
                )}
              </div>

              {/* Side Quick Actions */}
              <div className="detector-sidebar">
                <div className="sidebar-section-title">
                  <Sparkles size={14} className="text-accent-amber" />
                  <span>Available Quick Shortcuts:</span>
                </div>

                <div className="quick-presets-scroll">
                  {DEFAULT_PRESET_GESTURES.map((p) => (
                    <div key={p.id} className="quick-preset-item">
                      <span className="preset-item-emoji">{p.emoji}</span>
                      <div className="preset-item-info">
                        <strong>{p.name}</strong>
                        <p>"{p.phrase}"</p>
                      </div>
                    </div>
                  ))}

                  {customList.map((c) => (
                    <div key={c.id} className="quick-preset-item custom">
                      <span className="preset-item-emoji">{c.emoji}</span>
                      <div className="preset-item-info">
                        <strong>{c.name} <span className="custom-tag">Custom</span></strong>
                        <p>"{c.phrase}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enroll' && (
            <div className="enroll-layout">
              <div className="enroll-form">
                <h4>Record a Personalized Gesture</h4>
                <p className="enroll-desc">
                  Hold any natural hand pose comfortable for you. InterACT extracts the 21-point geometric skeleton and binds it to your phrase.
                </p>

                <div className="form-group">
                  <label>Macro Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Need Medical Help / Two Fingers Held"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Spoken Phrase to Agent:</label>
                  <input
                    type="text"
                    placeholder="e.g. Please expedite, I have a physical medical requirement."
                    value={customPhrase}
                    onChange={(e) => setCustomPhrase(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Icon / Emoji:</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={customEmoji}
                    onChange={(e) => setCustomEmoji(e.target.value)}
                    className="form-input emoji-input"
                  />
                </div>

                <div className="enroll-actions">
                  <button
                    type="button"
                    onClick={handleStartEnrollment}
                    disabled={enrollmentCountdown !== null}
                    className="btn btn-secondary"
                  >
                    <Camera size={16} className="mr-1" />
                    {enrollmentCountdown !== null
                      ? enrollmentCountdown === 0
                        ? '✅ Captured Pose!'
                        : `Hold Pose... ${enrollmentCountdown}s`
                      : 'Capture Hand Pose (3s Countdown)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCustomGesture}
                    disabled={!enrolledVector}
                    className="btn btn-primary"
                  >
                    <Check size={16} className="mr-1" />
                    Save & Activate Macro
                  </button>
                </div>
              </div>

              {/* Live Preview during enrollment */}
              <div className="enroll-video-preview">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video mirrored"
                />
                <canvas ref={canvasRef} className="camera-canvas" />

                {enrollmentCountdown !== null && enrollmentCountdown > 0 && (
                  <div className="countdown-overlay">
                    <span className="countdown-number">{enrollmentCountdown}</span>
                    <p>Hold hand pose steady</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div className="library-layout">
              <div className="library-section">
                <h4>System Preset Macros (Built-in)</h4>
                <div className="library-grid">
                  {DEFAULT_PRESET_GESTURES.map((g) => (
                    <div key={g.id} className="library-card">
                      <div className="card-emoji">{g.emoji}</div>
                      <div className="card-details">
                        <strong>{g.name}</strong>
                        <p>"{g.phrase}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="library-section">
                <h4>Your Custom Enrolled Macros</h4>
                {customList.length === 0 ? (
                  <p className="empty-custom-hint">
                    No custom gestures enrolled yet. Click "Enroll Custom Macro" to teach InterACT your personal hand poses!
                  </p>
                ) : (
                  <div className="library-grid">
                    {customList.map((c) => (
                      <div key={c.id} className="library-card custom">
                        <div className="card-emoji">{c.emoji}</div>
                        <div className="card-details">
                          <strong>{c.name}</strong>
                          <p>"{c.phrase}"</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(c.id)}
                          className="btn-delete"
                          title="Delete Custom Macro"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
