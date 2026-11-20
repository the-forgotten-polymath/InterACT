import React, { useState } from 'react';
import { X, Key, Globe, Shield, ExternalLink, Check, AlertCircle } from 'lucide-react';
import type { LiveKitConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LiveKitConfig;
  onSave: (config: LiveKitConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [livekitUrl, setLivekitUrl] = useState(config.livekitUrl || '');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [apiSecret, setApiSecret] = useState(config.apiSecret || '');
  const [token, setToken] = useState(config.token || '');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      livekitUrl: livekitUrl.trim(),
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      token: token.trim()
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="modal-title">LiveKit Connection Settings</h2>
          </div>
          <button className="icon-btn-ghost" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="settings-notice">
            <p>
              <strong>Need free LiveKit credentials?</strong> Create a free project at{' '}
              <a
                href="https://cloud.livekit.io"
                target="_blank"
                rel="noreferrer"
                className="external-link"
              >
                cloud.livekit.io <ExternalLink className="w-3.5 h-3.5 inline ml-1" />
              </a>{' '}
              (Free tier includes 50GB/month).
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              <Globe className="w-4 h-4 inline mr-1 text-slate-400" />
              LiveKit WebSocket URL
            </label>
            <input
              type="text"
              placeholder="wss://your-project.livekit.cloud"
              value={livekitUrl}
              onChange={e => setLivekitUrl(e.target.value)}
              className="form-input"
            />
            <span className="field-hint">e.g. wss://xyz.livekit.cloud or ws://localhost:7880</span>
          </div>

          <div className="grid-2-col">
            <div className="form-group">
              <label className="form-label">
                <Key className="w-4 h-4 inline mr-1 text-slate-400" />
                API Key
              </label>
              <input
                type="text"
                placeholder="APIxxxxxxxxxxxx"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Shield className="w-4 h-4 inline mr-1 text-slate-400" />
                API Secret
              </label>
              <input
                type="password"
                placeholder="secxxxxxxxxxxxx"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="divider-label">
            <span>OR Direct Token (Optional)</span>
          </div>

          <div className="form-group">
            <label className="form-label">Pre-generated JWT Token</label>
            <input
              type="text"
              placeholder="Paste token if you already generated one"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {saved ? (
                <>
                  <Check className="w-4 h-4 mr-1.5" /> Saved!
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
