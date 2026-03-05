# Quick Reference - MeetMind Commands

## Daily Development

```bash
# Start everything (run in separate terminals)
npm run docker:up          # Terminal 1: Infrastructure
npm run dev:backend        # Terminal 2: Backend
npm run dev:extension      # Terminal 3: Extension (optional)

# Stop everything
npm run docker:down
```

## First-Time Setup

```bash
# 1. Install
npm install
cd shared && npm run build && cd ..

# 2. Environment
cp .env.example .env
# Edit .env - add OPENAI_API_KEY

# 3. Infrastructure
npm run docker:up

# 4. N8n setup (manual)
# Open http://localhost:5678
# Add Google OAuth credentials
# Create 5 workflows (see infrastructure/n8n-setup.md)

# 5. Start backend
npm run dev:backend

# 6. Build extension
npm run dev:extension

# 7. Load in Chrome
# chrome://extensions/
# Load unpacked from extension/dist
```

## Useful Commands

### Docker
```bash
# View logs
npm run docker:logs

# Stop services
npm run docker:down

# Restart
npm run docker:down && npm run docker:up

# Clean slate (removes volumes)
docker-compose down -v
```

### Database
```bash
# Connect
docker exec -it meetmind-postgres psql -U meetmind -d meetmind

# Common queries
SELECT * FROM users;
SELECT * FROM interactions ORDER BY created_at DESC LIMIT 10;
SELECT * FROM tool_calls ORDER BY executed_at DESC LIMIT 10;
SELECT tool_name, COUNT(*) FROM tool_calls GROUP BY tool_name;

# Exit
\q
```

### Backend
```bash
# Dev mode (auto-reload)
npm run dev:backend

# Build
npm run build:backend

# Production
npm run start:backend

# Type check
cd backend && npm run type-check

# Lint
cd backend && npm run lint
```

### Extension
```bash
# Dev build (watch mode)
npm run dev:extension

# Production build
npm run build:extension

# Reload extension
# Click reload icon in chrome://extensions/
```

### Testing
```bash
# Backend health
curl http://localhost:3000/health

# List tools
curl http://localhost:3000/agent/tools

# Test agent
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "test@example.com",
    "userName": "Test",
    "query": "What can you do?",
    "context": {}
  }'

# Test n8n webhook
curl -X POST http://localhost:5678/webhook/calendar/get-events \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_events",
    "userId": "test",
    "parameters": {"maxResults": 5}
  }'
```

## URLs

- Backend: http://localhost:3000
- n8n: http://localhost:5678
- PostgreSQL: localhost:5432
- Extension: chrome://extensions/

## Common Issues

**Backend won't start:**
```bash
# Check database
docker ps
docker logs meetmind-postgres
```

**Extension errors:**
```bash
# Rebuild
npm run dev:extension
# Reload in Chrome
```

**Database reset:**
```bash
npm run docker:down
npm run docker:up
# Schema recreates on backend start
```

**n8n workflows not working:**
- Check workflows are activated
- Verify OAuth credentials
- Check execution logs in n8n

## Environment Variables

Required in `.env`:
- `OPENAI_API_KEY` - Your OpenAI key
- `DATABASE_URL` - PostgreSQL (default works)
- `N8N_HOST` - n8n URL (default works)
- `PORT` - Backend port (default 3000)

## Example Commands to Try

Once setup is complete, try these in the extension:

```
Show me my calendar for today

Schedule a test meeting tomorrow at 2pm for 1 hour

Send an email to yourself saying "MeetMind works!"

Search my drive for project files

Store a memory: We decided to use TypeScript

Search my memories for decisions
```

## File Locations

- Backend code: `backend/src/`
- Extension code: `extension/src/`
- Shared types: `shared/src/`
- Database schema: `backend/src/db/schema.ts`
- Agent core: `backend/src/agent/core.ts`
- Tools: `backend/src/tools/`

## Logs

**Backend logs:**
- Shown in terminal running `npm run dev:backend`
- Shows agent iterations, tool calls, errors

**n8n logs:**
- Access workflow executions (clock icon)
- Shows webhook calls and responses

**Extension logs:**
- Right-click extension → Inspect popup
- Console shows API calls and errors

## Git Workflow

```bash
# Feature branch
git checkout -b feature/my-feature

# Commit
git add .
git commit -m "Add: description"

# Push
git push origin feature/my-feature
```

## Help

- [README.md](README.md) - Overview
- [SETUP.md](SETUP.md) - Detailed setup
- [DEVELOPMENT.md](DEVELOPMENT.md) - Developer guide
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Current status
