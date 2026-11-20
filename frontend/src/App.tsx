import React, { useState } from 'react';
import { CustomerView } from './components/CustomerView';
import { AgentDashboard } from './components/AgentDashboard';
import { User, Headphones, Columns, Shield, Sparkles } from 'lucide-react';
import { InterACTApi } from './services/api';

export const App: React.FC = () => {
  // Support URL path routing or tab state
  const [activeTab, setActiveTab] = useState<'customer' | 'agent' | 'split'>(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('agent')) return 'agent';
    if (path.includes('customer') || path.includes('user')) return 'customer';
    return window.innerWidth > 960 ? 'split' : 'customer';
  });

  // Coordinated session for 1-click Split Test Mode
  const [splitSessionId, setSplitSessionId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchQuickTestSession = async () => {
    setIsLaunching(true);
    try {
      const res = await InterACTApi.createSession({
        business_context: {
          type: 'order',
          id: 'ZMT-4092',
          data: {
            app_source: 'zomato',
            customer_name: 'Rahul Sharma',
            delivery_partner: 'Amit K. (+91 98765 43210)',
            items_summary: 'Paneer Butter Masala x1, Garlic Naan x2 (Total ₹320)',
            delivery_address: 'Flat 402, Sunshine Heights, Koramangala'
          }
        }
      });
      setSplitSessionId(res.session_id);
    } catch (e: any) {
      console.error('Failed to create split test session:', e);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Global Top Nav */}
      <nav className="global-nav">
        <div className="nav-brand">
          <div className="nav-logo">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="nav-title">InterACT</h1>
            <p className="nav-subtitle">Multimodal Accessibility Engine</p>
          </div>
        </div>

        <div className="nav-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('customer')}
            className={`nav-tab-btn ${activeTab === 'customer' ? 'active' : ''}`}
          >
            <User className="w-4 h-4 mr-1" /> Customer Portal
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agent')}
            className={`nav-tab-btn ${activeTab === 'agent' ? 'active' : ''}`}
          >
            <Headphones className="w-4 h-4 mr-1" /> Agent Console
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('split')}
            className={`nav-tab-btn hidden-mobile ${activeTab === 'split' ? 'active' : ''}`}
            title="View both Customer & Agent side-by-side for 1-click testing"
          >
            <Columns className="w-4 h-4 mr-1" /> Split Test Mode
          </button>
        </div>
      </nav>

      {/* Main View Area */}
      <main className="app-main-content">
        {activeTab === 'customer' && <CustomerView />}
        {activeTab === 'agent' && <AgentDashboard />}
        {activeTab === 'split' && (
          <div className="split-wrapper">
            <div className="split-quickbar">
              <div className="quickbar-left">
                <span className="badge-split">SPLIT TEST MODE</span>
                <span className="quickbar-desc">
                  Side-by-side verification: Customer Type-to-Voice on left, Agent Console on right.
                </span>
              </div>
              <div className="quickbar-actions">
                <button
                  type="button"
                  onClick={handleLaunchQuickTestSession}
                  disabled={isLaunching}
                  className="btn btn-primary btn-sm"
                  title="Create and auto-connect both panels to the same live room"
                >
                  <Sparkles size={14} className="mr-1" />
                  {isLaunching ? 'Connecting...' : '⚡ 1-Click Launch Connected Session'}
                </button>
                {splitSessionId && (
                  <span className="session-active-pill">
                    Room: <strong>{splitSessionId}</strong>
                  </span>
                )}
              </div>
            </div>

            <div className="split-view-container">
              <div className="split-panel">
                <CustomerView
                  autoJoinSessionId={splitSessionId}
                  onSessionCreated={(id) => setSplitSessionId(id)}
                />
              </div>
              <div className="split-divider" />
              <div className="split-panel">
                <AgentDashboard
                  autoJoinSessionId={splitSessionId}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
