import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '../types';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage
}) => {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onSendMessage(draft.trim());
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <aside className="chat-drawer" aria-label="In-call chat">
      <div className="chat-header">
        <div className="chat-header-title">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h3>In-Call Chat</h3>
          <span className="chat-count-pill">{messages.length}</span>
        </div>
        <button className="icon-btn-ghost" onClick={onClose} aria-label="Close chat">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <MessageSquare className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">No messages yet.</p>
            <p className="text-xs text-slate-500">
              Messages sent here are visible to call participants.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={msg.id}
                className={`chat-bubble-row ${msg.isLocal ? 'bubble-local' : 'bubble-remote'}`}
              >
                <div className="chat-bubble">
                  <div className="chat-bubble-header">
                    <span className="chat-sender-name">
                      {msg.isLocal ? 'You' : msg.senderName}
                    </span>
                    <span className="chat-timestamp">{timeStr}</span>
                  </div>
                  <p className="chat-message-text">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-bar">
        <textarea
          rows={1}
          placeholder="Type a message..."
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="chat-textarea"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="chat-send-btn"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
