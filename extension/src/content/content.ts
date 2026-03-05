/**
 * Content Script
 * 
 * Runs on all web pages to capture context.
 * 
 * Responsibilities:
 * - Capture selected text
 * - Detect page context
 * - Listen for messages from popup
 * 
 * This script is minimal and passive - it doesn't inject UI or interfere with pages.
 */

console.log('MeetMind content script loaded');

/**
 * Get currently selected text on the page
 */
function getSelectedText(): string {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

/**
 * Get page metadata
 */
function getPageMetadata() {
  return {
    url: window.location.href,
    title: document.title,
    selectedText: getSelectedText(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Listen for messages from popup or background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Content script received message:', message);

  switch (message.action) {
    case 'getSelectedText':
      sendResponse({ selectedText: getSelectedText() });
      break;

    case 'getPageMetadata':
      sendResponse(getPageMetadata());
      break;

    case 'ping':
      sendResponse({ status: 'ok' });
      break;

    default:
      console.log('Unknown action:', message.action);
      sendResponse({ error: 'Unknown action' });
  }

  return false;
});

/**
 * Detect meeting platforms and extract additional context
 */
function detectMeetingContext() {
  const url = window.location.href;

  // Google Meet
  if (url.includes('meet.google.com')) {
    return {
      platform: 'meet',
      meetingId: window.location.pathname.split('/').pop(),
    };
  }

  // Zoom
  if (url.includes('zoom.us')) {
    return {
      platform: 'zoom',
      meetingId: window.location.pathname.split('/').pop(),
    };
  }

  // Microsoft Teams
  if (url.includes('teams.microsoft.com')) {
    return {
      platform: 'teams',
      meetingId: extractTeamsMeetingId(),
    };
  }

  return null;
}

/**
 * Extract Teams meeting ID from URL or page
 */
function extractTeamsMeetingId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('meetingId') || params.get('threadId');
  } catch {
    return null;
  }
}

// Notify background script if we're on a meeting page
const meetingContext = detectMeetingContext();
if (meetingContext) {
  console.log('Detected meeting context:', meetingContext);
  
  // Could send to background for tracking
  // chrome.runtime.sendMessage({
  //   action: 'meetingDetected',
  //   context: meetingContext,
  // });
}
