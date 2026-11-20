import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Mic,
  MicOff,
  Check,
  X,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  HelpCircle,
  FileText,
  Volume2
} from 'lucide-react';
import { SpeechService } from '../services/speech';
import { InterACTApi } from '../services/api';

interface FluencyShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (
    approvedText: string,
    rawTranscript: string,
    disfluencies: string[],
    preserved: string[]
  ) => void;
  onStartReviewing: () => void;
  speechLanguage: string;
}

export const FluencyShieldModal: React.FC<FluencyShieldModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  onStartReviewing,
  speechLanguage
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [reconstructedText, setReconstructedText] = useState('');
  const [disfluencies, setDisfluencies] = useState<string[]>([]);
  const [preservedEntities, setPreservedEntities] = useState<string[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number>(0.95);
  const [isProcessing, setIsProcessing] = useState(false);
  const [needsClarification, setNeedsClarification] = useState(false);
  const [clarificationPrompt, setClarificationPrompt] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [micHardwareOk, setMicHardwareOk] = useState<boolean | null>(null);

  const testHardwareMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicHardwareOk(true);
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop());
      }, 4000);
    } catch (err: any) {
      console.warn('Microphone permission check failed:', err);
      setMicHardwareOk(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const handleReset = () => {
    SpeechService.stopListening();
    setIsRecording(false);
    setInterimText('');
    setRawTranscript('');
    setReconstructedText('');
    setDisfluencies([]);
    setPreservedEntities([]);
    setIsProcessing(false);
    setNeedsClarification(false);
    setClarificationPrompt(null);
    setManualInput('');
  };

  const handleStartRecording = () => {
    if (!SpeechService.isSpeechRecognitionSupported()) {
      alert('Speech Recognition is not available in this browser. Please use Google Chrome or click one of the test presets below.');
      return;
    }

    handleReset();
    setIsRecording(true);

    SpeechService.startListening({
      language: speechLanguage,
      onInterim: (text) => setInterimText(text),
      onFinal: (finalText) => {
        setIsRecording(false);
        processRawTranscript(finalText);
      },
      onError: (err) => {
        console.warn('Speech recognition error:', err);
        setIsRecording(false);
      },
      onEnd: () => {
        setIsRecording(false);
      }
    });
  };

  const handleStopRecording = () => {
    SpeechService.stopListening();
    setIsRecording(false);
    if (interimText.trim()) {
      processRawTranscript(interimText.trim());
    }
  };

  // Process raw speech transcript via Fluency Shield API
  const processRawTranscript = async (raw: string) => {
    if (!raw.trim()) return;

    setRawTranscript(raw);
    setIsProcessing(true);
    onStartReviewing();

    try {
      const res = await InterACTApi.reconstructSpeech({
        raw_transcript: raw,
        language: speechLanguage
      });

      setRawTranscript(res.raw_transcript);
      setReconstructedText(res.reconstructed_text);
      setDisfluencies(res.disfluencies_detected);
      setPreservedEntities(res.preserved_entities);
      setConfidenceScore(res.confidence_score);
      setNeedsClarification(res.needs_clarification);
      setClarificationPrompt(res.clarification_prompt || null);
    } catch (err) {
      console.error('Reconstruction error:', err);
      // Fallback
      setReconstructedText(raw);
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick preset test samples
  const testPresets = [
    {
      label: 'Sample A: Repetitions & Fillers',
      text: 'um... uh... I... I... I need help with my my order #ZMT-4092'
    },
    {
      label: 'Sample B: Syllable Blocks',
      text: 'p-p-paneer t-t-tikka is cold, please arrange replacement'
    },
    {
      label: 'Sample C: Negation & Amount',
      text: 'uh I did not receive ₹320 refund for my food'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="fluency-modal-card">
        {/* Header */}
        <div className="fluency-modal-header">
          <div className="header-title">
            <div className="shield-icon-badge">
              <ShieldCheck size={22} className="text-primary-indigo" />
            </div>
            <div>
              <h3>Fluency Shield — Speech Review</h3>
              <p>Speak naturally. InterACT reconstructs disfluencies while preserving 100% of your meaning.</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-close" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Capture Area / Controls */}
        {!rawTranscript && !isProcessing ? (
          <div className="fluency-capture-area">
            <div className="capture-mic-center">
              <button
                type="button"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`btn-mic-large ${isRecording ? 'recording' : ''}`}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecording ? <MicOff size={36} /> : <Mic size={36} />}
              </button>

              <span className="mic-status-label">
                {isRecording ? 'Listening... Speak naturally (repetitions are OK)' : 'Tap Microphone to Speak'}
              </span>

              {isRecording && interimText && (
                <div className="live-speech-box">
                  <span className="label">Live Capturing:</span>
                  <p className="interim-text">"{interimText}"</p>
                </div>
              )}

              {/* Hardware Mic Permissions Verification */}
              <div className="mic-hardware-status">
                <button
                  type="button"
                  onClick={testHardwareMic}
                  className="btn btn-outline btn-xs"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', marginTop: '8px' }}
                >
                  <Mic size={12} className="mr-1" />
                  {micHardwareOk === true
                    ? '✅ Mic Hardware Active & Permitted'
                    : micHardwareOk === false
                    ? '⚠️ Mic Blocked in Browser Settings'
                    : 'Check Hardware Mic Status'}
                </button>
              </div>
            </div>

            {/* Manual Text Input for instant testing */}
            <div className="fluency-manual-input">
              <div className="presets-header">
                <Sparkles size={14} className="text-primary-indigo" />
                <span>Or type/paste speech with stutters to verify clean reconstruction:</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. p-p-paneer burger without onion #ZMT-4092 please"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualInput.trim()) {
                      processRawTranscript(manualInput.trim());
                    }
                  }}
                  className="manual-speech-input"
                />
                <button
                  type="button"
                  disabled={!manualInput.trim()}
                  onClick={() => processRawTranscript(manualInput.trim())}
                  className="btn btn-primary btn-sm"
                >
                  Clean
                </button>
              </div>
            </div>

            {/* Test Presets for Demo */}
            <div className="test-presets-box">
              <div className="presets-header">
                <Sparkles size={14} className="text-accent-amber" />
                <span>Or select a test sample with dysarthria/stutter disfluency:</span>
              </div>
              <div className="preset-buttons">
                {testPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="preset-btn"
                    onClick={() => processRawTranscript(preset.text)}
                  >
                    <span className="preset-title">{preset.label}</span>
                    <span className="preset-quote">"{preset.text}"</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : isProcessing ? (
          <div className="fluency-loading-area">
            <Sparkles size={32} className="spin-icon text-primary-indigo" />
            <p>InterACT AI is analyzing disfluencies and verifying semantic preservation...</p>
          </div>
        ) : (
          /* Dual Transcript Side-by-Side Review */
          <div className="fluency-review-area">
            {needsClarification ? (
              <div className="clarification-banner">
                <AlertTriangle size={20} className="text-accent-amber" />
                <div>
                  <strong>Speech Ambiguous:</strong>
                  <p>{clarificationPrompt || 'Please speak again with more detail.'}</p>
                </div>
              </div>
            ) : (
              <div className="dual-transcript-grid">
                {/* Left: Original Raw Speech */}
                <div className="transcript-card raw-card">
                  <div className="card-top">
                    <span className="badge-tag tag-raw">Original Raw Speech</span>
                    <span className="tag-meta">Preserved for Transparency</span>
                  </div>

                  <div className="raw-text-content">
                    "{rawTranscript}"
                  </div>

                  {disfluencies.length > 0 && (
                    <div className="disfluencies-list">
                      <span className="section-label">Disfluencies Detected & Cleaned:</span>
                      <div className="pill-wrap">
                        {disfluencies.map((d, i) => (
                          <span key={i} className="disfluency-pill">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Reconstructed Proposal with Inline Edit */}
                <div className="transcript-card reconstructed-card">
                  <div className="card-top">
                    <span className="badge-tag tag-reconstructed">
                      <Sparkles size={12} className="mr-1" />
                      InterACT Proposal (Cleaned)
                    </span>
                    <span className="confidence-pill">
                      {Math.round(confidenceScore * 100)}% Confident
                    </span>
                  </div>

                  <div className="editable-proposal-wrapper">
                    <label className="edit-label">
                      Review & Edit below before approving:
                    </label>
                    <textarea
                      value={reconstructedText}
                      onChange={(e) => setReconstructedText(e.target.value)}
                      rows={3}
                      className="proposal-textarea"
                    />
                  </div>

                  {preservedEntities.length > 0 && (
                    <div className="preserved-list">
                      <span className="section-label">Critical Semantics Preserved:</span>
                      <div className="pill-wrap">
                        {preservedEntities.map((p, i) => (
                          <span key={i} className="preserved-pill">
                            <Check size={11} className="mr-1" />
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approval Gate Decision Actions */}
            <div className="review-actions-bar">
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary"
              >
                <RotateCcw size={16} className="mr-1" />
                Re-record Speech
              </button>

              <div className="right-actions">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-outline"
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onApprove(reconstructedText, rawTranscript, disfluencies, preservedEntities);
                    onClose();
                  }}
                  disabled={!reconstructedText.trim() || needsClarification}
                  className="btn btn-primary btn-approve"
                >
                  <Check size={18} className="mr-1-5" />
                  Approve & Speak to Specialist
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
