/**
 * Background Service Worker
 * 
 * Handles background tasks for the extension.
 * In Phase 1, this is minimal - mainly for context menu and icon management.
 * 
 * Future enhancements:
 * - Periodic background sync
 * - Notifications
 * - Offline queue
 */

console.log('MeetMind background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('MeetMind installed!');
    
    // Open welcome page (optional)
    // chrome.tabs.create({ url: 'https://meetmind.dev/welcome' });
  } else if (details.reason === 'update') {
    console.log('MeetMind updated to version', chrome.runtime.getManifest().version);
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('Background received message:', message);

  // Handle different message types
  switch (message.action) {
    case 'ping':
      sendResponse({ status: 'ok' });
      break;

    case 'captureTab':
      // Capture tab information
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        sendResponse({
          url: tab.url,
          title: tab.title,
          id: tab.id,
        });
      });
      return true; // Will respond asynchronously

    default:
      console.log('Unknown message action:', message.action);
      sendResponse({ error: 'Unknown action' });
  }

  return false;
});

// Listen for tab updates (can be used to detect meeting pages)
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if it's a meeting URL
    if (
      tab.url.includes('meet.google.com') ||
      tab.url.includes('zoom.us') ||
      tab.url.includes('teams.microsoft.com')
    ) {
      console.log('Meeting tab detected:', tab.url);
      
      // Could show a notification or badge here
      // chrome.action.setBadgeText({ text: '🎙️', tabId });
    }
  }
});

// Handle keyboard shortcuts (if configured in manifest)
chrome.commands?.onCommand.addListener((command) => {
  console.log('Command triggered:', command);
  
  if (command === 'open-meetmind') {
    // Open popup
    chrome.action.openPopup();
  }
});
