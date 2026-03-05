# MeetMind Chrome Extension

Chrome extension for MeetMind - provides the user interface for the AI agent.

## Architecture

```
extension/
├── src/
│   ├── popup/          # Main UI (React)
│   │   ├── Popup.tsx         # Main popup component
│   │   ├── popup.css         # Styles
│   │   └── index.html        # Popup HTML
│   ├── background/     # Service worker
│   │   └── background.ts     # Background tasks
│   ├── content/        # Content script
│   │   └── content.ts        # Page context capture
│   ├── api/            # Backend communication
│   │   └── client.ts         # API client
│   └── utils/          # Utilities
│       └── context.ts        # Context capture helpers
├── public/
│   ├── manifest.json         # Extension manifest
│   └── icons/                # Extension icons
├── package.json
├── tsconfig.json
└── vite.config.ts            # Build configuration
```

## Features

### Popup Interface
- Command input
- Real-time agent responses
- Action history
- Backend status indicator

### Context Capture
- Current URL
- Page title
- Selected text
- Meeting detection (Meet, Zoom, Teams)

### Local Storage
- User credentials
- Session ID
- Preferences

## Development

```bash
# Install dependencies
npm install

# Build in watch mode (auto-rebuild on changes)
npm run dev

# Build for production
npm run build
```

## Loading Extension

1. Build the extension: `npm run build`
2. Open Chrome: `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `extension/dist` folder

## Extension Structure

### manifest.json

Defines:
- Permissions (activeTab, storage, tabs)
- Background service worker
- Content scripts
- Popup UI

### Popup (React)

Main interface:
- User setup (email/name)
- Command input
- Response display
- Status indicators

### Background Script

Handles:
- Extension lifecycle
- Tab monitoring
- Message passing

### Content Script

Runs on all pages to:
- Capture selected text
- Extract page metadata
- Detect meeting platforms

## API Communication

Extension → Backend:

```typescript
// Send query
const response = await sendAgentQuery(
  query,
  context,
  { userEmail, userName, sessionId }
);
```

All API calls go through `src/api/client.ts`.

## Context Capture

The extension captures:

```typescript
{
  url: string;
  pageTitle: string;
  selectedText?: string;
  tabs: TabContext[];
  meetingMetadata?: {
    platform: 'meet' | 'zoom' | 'teams';
    title: string;
    meetingId?: string;
  };
}
```

## Storage

Uses `chrome.storage.local`:
- `userEmail`: User's email
- `userName`: User's name
- `sessionId`: Current session ID

## Permissions

Required permissions:
- **activeTab**: Access current tab info
- **storage**: Store user preferences
- **tabs**: Query tab information

Host permissions:
- `http://localhost:3000/*`: Backend API access

## Building for Production

1. Update `manifest.json` version
2. Update backend URL in `src/api/client.ts`
3. Build: `npm run build`
4. Test thoroughly
5. Zip `dist` folder for distribution

## Troubleshooting

### Extension not loading
- Check `dist/manifest.json` exists
- Verify all icons are present
- Check browser console for errors

### Can't connect to backend
- Ensure backend is running on `localhost:3000`
- Check CORS configuration
- Verify network requests in DevTools

### Context not capturing
- Check content script is loaded
- Verify permissions in manifest
- Check console logs

## Future Enhancements

Phase 2:
- Conversation history view
- Action item tracking
- Meeting summaries panel

Phase 3:
- Proactive suggestions
- Quick actions menu
- Keyboard shortcuts

Phase 4:
- Cloud sync
- Team features
- Analytics dashboard
