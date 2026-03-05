# MeetMind Backend

Backend for MeetMind - the AI Workspace Execution Agent.

## Architecture

```
backend/
├── src/
│   ├── agent/          # Agent core and tool registry
│   │   ├── core.ts           # Main agent execution loop
│   │   └── toolRegistry.ts   # Tool registration and routing
│   ├── db/             # Database layer
│   │   ├── schema.ts         # PostgreSQL schema definition
│   │   └── queries.ts        # Database queries
│   ├── routes/         # HTTP routes
│   │   └── agent.ts          # Agent API endpoints
│   ├── services/       # External services
│   │   ├── openai.ts         # OpenAI API client
│   │   ├── n8nClient.ts      # n8n webhook client
│   │   └── memoryStore.ts    # Memory operations
│   ├── tools/          # Tool implementations
│   │   ├── calendar.ts       # Calendar operations
│   │   ├── email.ts          # Email operations
│   │   ├── drive.ts          # Drive operations
│   │   └── memory.ts         # Memory operations
│   └── server.ts       # Server entry point
├── package.json
└── tsconfig.json
```

## Key Concepts

### Agent Loop

The agent operates in an iterative loop:

1. User sends query with context
2. Agent calls OpenAI with available tools
3. OpenAI decides:
   - Call tools → Execute and loop back
   - Final response → Return to user
   - Need clarification → Ask user
4. All interactions logged to database

### Tool System

Tools are:
- **Atomic**: One clear purpose
- **Deterministic**: Same input = same output
- **Logged**: Every execution recorded
- **Isolated**: No cross-tool dependencies

### Memory System

Two types of memory:
- **Short-term**: Active conversation (in-memory)
- **Long-term**: Persisted to PostgreSQL

Phase 2 will add vector embeddings for semantic search.

## API Endpoints

### POST /agent/run

Execute agent with user query.

**Request:**
```json
{
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "sessionId": "optional-session-id",
  "query": "Schedule a meeting tomorrow at 2pm",
  "context": {
    "url": "https://meet.google.com/abc-def-ghi",
    "pageTitle": "Team Sync",
    "selectedText": "...",
    "meetingMetadata": {}
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Meeting scheduled for tomorrow at 2pm",
  "actions": [
    {
      "toolName": "create_calendar_event",
      "parameters": {...},
      "result": {...},
      "timestamp": "2024-03-15T14:30:00Z",
      "success": true
    }
  ]
}
```

### POST /agent/session

Create new session.

### GET /agent/session/:sessionId

Get session info.

### GET /agent/tools

List available tools.

## Environment Variables

See `.env.example` in root directory.

Required:
- `OPENAI_API_KEY`: OpenAI API key
- `DATABASE_URL`: PostgreSQL connection string
- `N8N_HOST`: n8n instance URL
- `N8N_WEBHOOK_URL`: n8n webhook base URL

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run database migrations
npm run migrate
```

## Database Schema

See `src/db/schema.ts` for full schema.

Key tables:
- `users`: User accounts
- `sessions`: Active sessions
- `interactions`: Query/response logs
- `tool_calls`: Tool execution logs
- `meetings`: Meeting records
- `memories`: Long-term memory

## Adding New Tools

1. Create tool file in `src/tools/`
2. Define tool schema (for OpenAI)
3. Implement executor function
4. Register in `src/agent/toolRegistry.ts`
5. Add n8n workflow if needed

Example:
```typescript
// src/tools/mytool.ts
export const myToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'my_tool',
    description: 'What this tool does',
    parameters: { /* schema */ }
  }
};

export async function executeMyTool(
  userId: string,
  params: any
): Promise<ToolResult> {
  // Implementation
}
```

## Error Handling

All errors are:
1. Logged to console
2. Recorded in database
3. Returned as structured responses
4. Never expose internal implementation

## Testing

Currently manual testing via:
- Health endpoint: `GET /health`
- Tools list: `GET /agent/tools`
- Agent execution: `POST /agent/run`

Phase 2 will add automated tests.

## Production Deployment

Not yet configured. Phase 4 will add:
- Cloud deployment
- Redis session store
- Background job queue
- Rate limiting
- Observability
