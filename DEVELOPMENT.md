# Development Guide

Guide for developers working on MeetMind.

## Project Philosophy

MeetMind is built with these principles:

1. **Clarity over cleverness** - Code should be readable
2. **Explicit over implicit** - No magic, clear contracts
3. **Modular architecture** - Each component has one job
4. **Type safety** - TypeScript everywhere
5. **Full logging** - Everything is tracked

## Architecture Overview

```
┌─────────────┐
│  Extension  │  React UI + Context Capture
└──────┬──────┘
       │ HTTP
┌──────▼──────┐
│   Backend   │  Fastify + Agent Loop
└──────┬──────┘
       │
   ┌───┴────┬────────┐
   │        │        │
┌──▼──┐  ┌─▼──┐  ┌──▼───┐
│ DB  │  │n8n │  │OpenAI│
└─────┘  └────┘  └──────┘
```

## Code Organization

### Backend Structure

- **routes/**: HTTP endpoints (thin layer)
- **agent/**: Core reasoning loop + tool registry
- **tools/**: Individual tool implementations
- **services/**: External integrations (OpenAI, n8n, memory)
- **db/**: Database schema and queries

### Key Design Patterns

**Agent Loop (core.ts):**
```
1. Receive request
2. Build context from memory
3. Call OpenAI with tools
4. If tool calls:
   - Execute tools
   - Log results
   - Loop back to step 3
5. Return final response
```

**Tool Pattern:**
```typescript
// 1. Define schema
export const myToolDefinition: ToolDefinition = { /* ... */ };

// 2. Implement executor
export async function executeMyTool(
  userId: string,
  params: MyParams
): Promise<ToolResult> {
  // Validate
  // Execute
  // Return structured result
}

// 3. Register in toolRegistry.ts
```

**Database Pattern:**
```typescript
// 1. Define schema in db/schema.ts
// 2. Create query functions in db/queries.ts
// 3. Use in services or routes
```

## Development Workflow

### Making Changes

**Backend:**
1. Edit files in `backend/src/`
2. Changes auto-reload (tsx watch)
3. Test via extension or curl
4. Check logs for errors

**Extension:**
1. Edit files in `extension/src/`
2. Rebuild: `npm run dev:extension`
3. Reload extension in Chrome
4. Test changes

**Shared Types:**
1. Edit `shared/src/types.ts`
2. Rebuild: `cd shared && npm run build`
3. Changes available in backend/extension

### Testing Changes

**Backend API:**
```bash
# Health check
curl http://localhost:3000/health

# List tools
curl http://localhost:3000/agent/tools

# Test agent
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "test@example.com",
    "userName": "Test User",
    "query": "What tools do you have?",
    "context": {}
  }'
```

**Database:**
```bash
# Connect to database
docker exec -it meetmind-postgres psql -U meetmind -d meetmind

# Check tables
\dt

# View interactions
SELECT * FROM interactions ORDER BY created_at DESC LIMIT 5;

# View tool calls
SELECT * FROM tool_calls ORDER BY executed_at DESC LIMIT 10;
```

**n8n Workflows:**
- Access: http://localhost:5678
- Check executions (clock icon)
- View workflow logs
- Test with manual execution

## Adding Features

### New Tool

1. Create `backend/src/tools/mytool.ts`:
```typescript
import type { ToolDefinition, ToolResult } from '@meetmind/shared';

export const myToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'my_tool',
    description: 'Clear description for LLM',
    parameters: {
      type: 'object',
      properties: {
        param1: {
          type: 'string',
          description: 'What param1 does',
        },
      },
      required: ['param1'],
    },
  },
};

export async function executeMyTool(
  userId: string,
  params: { param1: string }
): Promise<ToolResult> {
  try {
    // Validate
    if (!params.param1) {
      return { success: false, error: 'param1 required' };
    }

    // Execute
    const result = await doSomething(params.param1);

    // Return
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

2. Register in `backend/src/agent/toolRegistry.ts`:
```typescript
import { myToolDefinition, executeMyTool } from '../tools/mytool';

// In getToolRegistry():
registry.definitions.push(myToolDefinition);
registry.executors.set('my_tool', executeMyTool);
```

3. Add n8n workflow if tool needs external API

4. Test!

### New Database Table

1. Add schema in `backend/src/db/schema.ts`:
```sql
CREATE TABLE IF NOT EXISTS my_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_my_table_user_id ON my_table(user_id);
```

2. Add queries in `backend/src/db/queries.ts`:
```typescript
export async function createMyRecord(userId: string, data: any) {
  const pool = getPool();
  const result = await pool.query(
    'INSERT INTO my_table (user_id, data) VALUES ($1, $2) RETURNING *',
    [userId, JSON.stringify(data)]
  );
  return result.rows[0];
}
```

3. Restart backend (schema runs on startup)

### New API Endpoint

1. Add to `backend/src/routes/agent.ts` (or create new route file):
```typescript
fastify.get('/my-endpoint', async (request, reply) => {
  try {
    // Logic
    return reply.send({ status: 'ok', data: result });
  } catch (error) {
    fastify.log.error('Error:', error);
    return reply.status(500).send({ error: 'Failed' });
  }
});
```

2. Register route in `backend/src/server.ts` if new file

## Debugging

### Backend Logs

Backend uses Pino logger with pretty printing:
```
[14:30:45] INFO: Running agent for user abc-123, query: schedule meeting
[14:30:46] INFO: Executing tool: create_calendar_event
```

### Database State

```sql
-- Recent interactions
SELECT 
  i.query,
  i.response,
  i.status,
  COUNT(tc.id) as tool_calls
FROM interactions i
LEFT JOIN tool_calls tc ON tc.interaction_id = i.id
GROUP BY i.id
ORDER BY i.created_at DESC
LIMIT 10;

-- Tool usage stats
SELECT 
  tool_name,
  COUNT(*) as total,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful
FROM tool_calls
GROUP BY tool_name;
```

### Extension Debugging

1. Right-click extension icon → "Inspect popup"
2. Check Console for errors
3. Check Network tab for API calls
4. Check Application → Storage for saved data

### n8n Debugging

1. Click workflow
2. Click executions (clock icon)
3. View each node's input/output
4. Check error messages
5. Use manual execution to test

## Common Issues

**"Tool not found":**
- Check toolRegistry.ts registration
- Verify tool name matches exactly
- Rebuild backend

**"Database connection failed":**
- Check Docker is running: `docker ps`
- Check DATABASE_URL in .env
- Verify PostgreSQL is healthy: `docker logs meetmind-postgres`

**"n8n webhook failed":**
- Check n8n is running: http://localhost:5678
- Verify workflow is active
- Check OAuth credentials are valid
- Review n8n execution logs

**"Extension can't connect":**
- Verify backend is running on port 3000
- Check CORS configuration
- Look for errors in browser console

## Code Style

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Document complex logic with comments
- Keep functions focused and small
- Use async/await (not callbacks)
- Handle errors explicitly
- Log errors with context

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit frequently
git add .
git commit -m "Add: feature description"

# Push and create PR
git push origin feature/my-feature
```

Commit message format:
- `Add:` new feature
- `Fix:` bug fix
- `Update:` changes to existing
- `Refactor:` code restructure
- `Docs:` documentation only

## Performance Considerations

Current optimizations:
- Database connection pooling
- Indexed queries
- Single-pass agent loop
- Minimal context passing

Future optimizations (Phase 3+):
- Response streaming
- Query result caching
- Background job processing
- Rate limiting

## Security Notes

Current state (local dev):
- No authentication
- HTTP only
- Local database
- No rate limiting

Production requirements (Phase 4):
- User authentication
- HTTPS/TLS
- Managed database
- API rate limiting
- Input sanitization
- Secret management

## Next Steps for Development

Phase 2 priorities:
1. Add vector search (pgvector)
2. Implement semantic memory
3. Add conversation history view
4. Improve context awareness
5. Add automated tests

Phase 3 priorities:
1. Proactive suggestions
2. Action item tracking
3. Meeting analysis
4. Decision trending
5. Project clustering

## Resources

- [Fastify Docs](https://www.fastify.io/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [n8n Documentation](https://docs.n8n.io/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
