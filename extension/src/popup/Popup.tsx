/**
 * Popup Component - Main UI for MeetMind Extension
 * 
 * This is the primary interface users interact with.
 * Clean, simple, action-oriented design.
 * 
 * Features:
 * - Command input
 * - Response display
 * - Action history
 * - Status indicators
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import type { ExecutedAction } from '@meetmind/shared';
import { sendAgentQuery, checkBackendHealth } from '../api/client';
import { captureCurrentContext, getUserInfo, saveUserInfo, getSessionId } from '../utils/context';
import './popup.css';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'success' | 'error' | 'requires_confirmation';
  actions?: ExecutedAction[];
}

function Popup() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Check backend health on mount
  useEffect(() => {
    checkHealth();
    loadUserInfo();
  }, []);

  async function checkHealth() {
    const online = await checkBackendHealth();
    setBackendOnline(online);
  }

  async function loadUserInfo() {
    const userInfo = await getUserInfo();
    if (userInfo) {
      setUserEmail(userInfo.email);
      setUserName(userInfo.name);
      setIsSetup(true);
    }

    const storedSessionId = await getSessionId();
    setSessionId(storedSessionId);
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (userEmail && userName) {
      await saveUserInfo(userEmail, userName);
      setIsSetup(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!query.trim() || !isSetup) return;

    const currentQuery = query.trim();
    setLoading(true);
    setQuery(''); // Clear input immediately for better UX

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: currentQuery,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Capture context
      const context = await captureCurrentContext();

      // Send query
      const result = await sendAgentQuery(currentQuery, context, {
        userEmail,
        userName,
        sessionId: sessionId || undefined,
      });

      // Add assistant response to chat
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: result.message || 'Task completed',
        timestamp: new Date(),
        status: result.status,
        actions: result.actions,
      };
      setMessages((prev) => [...prev, assistantMessage]);

    } catch (error) {
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: error instanceof Error ? error.message : 'An error occurred',
        timestamp: new Date(),
        status: 'error',
        actions: [],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  // Setup screen
  if (!isSetup) {
    return (
      <div className="container">
        <header>
          <h1>🧠 MeetMind</h1>
          <p className="tagline">AI Workspace Execution Agent</p>
        </header>

        <div className="setup">
          <h2>Welcome!</h2>
          <p>Let's get you set up. We need a few details to get started.</p>

          <form onSubmit={handleSetup}>
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="input-group">
              <label>Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your Name"
                required
              />
            </div>

            <button type="submit" className="btn-primary">
              Get Started
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main interface
  return (
    <div className="container">
      <header>
        <h1>🧠 MeetMind</h1>
        <div className="status">
          {backendOnline === null ? (
            <span className="status-checking">Checking...</span>
          ) : backendOnline ? (
            <span className="status-online">● Online</span>
          ) : (
            <span className="status-offline">● Offline</span>
          )}
        </div>
      </header>

      {/* Chat History */}
      <div className="chat-history">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>👋 Hi {userName}!</p>
            <p>I can help you with:</p>
            <ul>
              <li>📅 Managing your calendar</li>
              <li>📧 Sending emails</li>
              <li>📁 Searching Drive files</li>
              <li>🧠 Storing memories</li>
            </ul>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message message-${msg.type}`}>
            {msg.type === 'user' ? (
              <div className="message-content user-message">
                <div className="message-text">{msg.content}</div>
              </div>
            ) : (
              <div className="message-content assistant-message">
                <div className={`message-status status-${msg.status}`}>
                  {msg.status === 'success' && '✓'}
                  {msg.status === 'error' && '✗'}
                  {msg.status === 'requires_confirmation' && '⚠'}
                </div>
                <div className="message-text">{msg.content}</div>
                
                {msg.actions && msg.actions.length > 0 && (
                  <div className="message-actions">
                    {msg.actions.map((action: ExecutedAction, idx: number) => (
                      <div key={idx} className={`action ${action.success ? 'success' : 'error'}`}>
                        <span className="action-icon">{action.success ? '✓' : '✗'}</span>
                        <span className="action-name">{action.toolName}</span>
                        {action.errorMessage && (
                          <span className="action-error">{action.errorMessage}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="message message-assistant">
            <div className="message-content assistant-message">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="command-form">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What would you like me to do?"
          rows={2}
          disabled={loading || !backendOnline}
          className="command-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        <button
          type="submit"
          disabled={loading || !query.trim() || !backendOnline}
          className="btn-primary"
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>

      {!backendOnline && (
        <div className="warning">
          <p>⚠ Backend is offline. Please start the MeetMind backend server.</p>
          <button onClick={checkHealth} className="btn-secondary">
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
