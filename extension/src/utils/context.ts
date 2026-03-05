/**
 * Context Utilities
 * 
 * Extracts context from the current browser state.
 * This context is sent to the backend to help the agent understand the user's situation.
 */

import type { SessionContext, TabContext } from '@meetmind/shared';

/**
 * Capture context from current tab
 */
export async function captureCurrentContext(): Promise<SessionContext> {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      return {};
    }

    // Get all tabs (for context)
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const tabs: TabContext[] = allTabs.map((t) => ({
      url: t.url || '',
      title: t.title || '',
      active: t.active || false,
    }));

    // Try to get selected text from content script
    let selectedText: string | undefined;
    try {
      const response = await chrome.tabs.sendMessage(tab.id!, { action: 'getSelectedText' });
      selectedText = response?.selectedText;
    } catch (error) {
      // Content script might not be loaded yet
      console.log('Could not get selected text:', error);
    }

    // Detect meeting metadata from URL/title
    const meetingMetadata = detectMeetingMetadata(tab.url, tab.title);

    return {
      url: tab.url,
      pageTitle: tab.title,
      selectedText,
      tabs: tabs.slice(0, 10), // Limit to 10 tabs
      meetingMetadata,
    };
  } catch (error) {
    console.error('Error capturing context:', error);
    return {};
  }
}

/**
 * Detect meeting metadata from URL and title
 */
function detectMeetingMetadata(url?: string, title?: string) {
  if (!url) return undefined;

  // Google Meet detection
  if (url.includes('meet.google.com')) {
    return {
      platform: 'meet' as const,
      title: title || 'Google Meet',
      meetingId: extractMeetingId(url),
    };
  }

  // Zoom detection
  if (url.includes('zoom.us')) {
    return {
      platform: 'zoom' as const,
      title: title || 'Zoom Meeting',
      meetingId: extractMeetingId(url),
    };
  }

  // Teams detection
  if (url.includes('teams.microsoft.com')) {
    return {
      platform: 'teams' as const,
      title: title || 'Microsoft Teams',
      meetingId: extractMeetingId(url),
    };
  }

  return undefined;
}

/**
 * Extract meeting ID from URL
 */
function extractMeetingId(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return pathParts[pathParts.length - 1] || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Store session ID in chrome.storage
 */
export async function saveSessionId(sessionId: string): Promise<void> {
  await chrome.storage.local.set({ sessionId });
}

/**
 * Get session ID from chrome.storage
 */
export async function getSessionId(): Promise<string | null> {
  const result = await chrome.storage.local.get('sessionId');
  return result.sessionId || null;
}

/**
 * Store user info in chrome.storage
 */
export async function saveUserInfo(email: string, name: string): Promise<void> {
  await chrome.storage.local.set({ userEmail: email, userName: name });
}

/**
 * Get user info from chrome.storage
 */
export async function getUserInfo(): Promise<{ email: string; name: string } | null> {
  const result = await chrome.storage.local.get(['userEmail', 'userName']);
  if (result.userEmail && result.userName) {
    return { email: result.userEmail, name: result.userName };
  }
  return null;
}
