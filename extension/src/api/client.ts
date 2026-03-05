/**
 * API Client for Backend Communication
 * 
 * Handles all HTTP requests to the MeetMind backend.
 * This is the only file that knows about the backend API structure.
 */

import type { AgentResponse, SessionContext } from '@meetmind/shared';

const API_BASE_URL = 'http://localhost:3000';

/**
 * Send query to agent
 */
export async function sendAgentQuery(
  query: string,
  context: SessionContext,
  options?: {
    userEmail?: string;
    userName?: string;
    sessionId?: string;
  }
): Promise<AgentResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        context,
        userEmail: options?.userEmail,
        userName: options?.userName,
        sessionId: options?.sessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send query');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
}

/**
 * Create a new session
 */
export async function createSession(
  userEmail: string,
  userName: string,
  context?: SessionContext
): Promise<{ id: string; userId: string; startedAt: Date }> {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail,
        userName,
        context: context || {},
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const data = await response.json();
    return data.session;
  } catch (error) {
    console.error('Session creation error:', error);
    throw error;
  }
}

/**
 * Check backend health
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
    });

    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Get available tools (for debugging)
 */
export async function getAvailableTools(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/agent/tools`, {
      method: 'GET',
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.tools || [];
  } catch (error) {
    console.error('Get tools error:', error);
    return [];
  }
}
