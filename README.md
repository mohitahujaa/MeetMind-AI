# MeetMind - AI Workspace Execution Agent

MeetMind is a context-aware AI execution layer that enables cross-application workflows without context switching.

## 🎯 Project Status

**Phase 1 Complete:** ✅ Ready for n8n setup and testing

- ✅ **Phase 1A** - Backend Foundation + Extension MVP
- ✅ **Phase 1B** - Deterministic Agent Core
- ✅ **Phase 1C** - Tool Execution Bridge to n8n

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for complete implementation details.

## 🚀 What MeetMind Does

MeetMind is an AI agent that executes cross-application workflows from natural language commands:

- **"Schedule team sync Friday 2pm"** → Creates Google Calendar event
- **"Send follow-up email to john@example.com"** → Composes and sends via Gmail
- **"Find my project proposal in Drive"** → Searches Google Drive
- **"Remember we decided to use React"** → Stores decision in memory
- **"Summarize this meeting and email the team"** → Multi-step workflow execution

All from a Chrome extension, with full execution logging and error recovery.

## 🏗️ Architecture

```
Chrome Extension (React)
    ↓
Backend API (Fastify + TypeScript)
    ↓
Agent Core (Deterministic Loop)
    ↓
Tool Registry (7 tools)
    ↓
n8n Webhooks → Google APIs (Calendar/Gmail/Drive)
    ↓
PostgreSQL (Full audit trail)
```

**Key Principles:**
- Extension is "dumb" (just UI + context capture)
- Backend owns all intelligence
- Agent loop is deterministic and observable
- Tools are atomic and defensive
- n8n handles OAuth and Google API calls
- Database logs everything

## 📦 Phase 1 Features

### Agent Core (Phase 1B)
- 🤖 Deterministic execution loop with explicit states
- 🔒 Safety constraints (max 5 iterations, max 10 tools per iteration)
- 📝 Comprehensive logging (console + database)
- 🛡️ Defensive programming (never assumes success)
- 🔄 Error recovery and graceful degradation

### Tools (Phase 1C)
- 📅 **Calendar:** Create events, get upcoming meetings
- 📧 **Email:** Send emails via Gmail
- 📁 **Drive:** Search files, fetch by ID/name
- 🧠 **Memory:** Store and search decisions/notes

### Extension
- 🎨 React UI with clean, modern design
- 📋 Context capture (URL, selected text, page title)
- 🎙️ Meeting platform detection (Meet, Zoom, Teams)
- 💾 Chrome storage integration

### Infrastructure
- 🐘 PostgreSQL 15 with full schema
- 🔧 n8n for workflow automation
- 🐳 Docker Compose for local development
- 📊 Complete database logging

## 🚀 Quick Start

**Complete setup guide:** See [SETUP.md](SETUP.md)

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Chrome browser
- OpenAI API key
- Google OAuth credentials (for n8n)

### Installation Steps

```bash
# 1. Install dependencies
npm install
cd shared && npm run build && cd ..

# 2. Configure environment
cp .env.example backend/.env
# Edit backend/.env and add OPENAI_API_KEY

# 3. Start infrastructure
npm run docker:up

# 4. Configure n8n
# Visit http://localhost:5678
# Create 5 workflows (see infrastructure/n8n-setup.md)
# Add Google OAuth credentials

# 5. Start backend
npm run dev:backend

# 6. Build extension
npm run dev:extension

# 7. Load in Chrome
# chrome://extensions/ → Load unpacked → select extension/dist
```

### Test the System

```bash
# Simple query
curl -X POST http://localhost:3000/agent/run \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "you@example.com",
    "userName": "Your Name",
    "query": "What can you do?",
    "context": {}
  }'
```

**Complete testing guide:** See [TESTING_E2E.md](TESTING_E2E.md)

## 📚 Documentation

- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Complete implementation status for Phase 1A/1B/1C
- **[SETUP.md](SETUP.md)** - Detailed setup and configuration guide
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Developer guide and workflows
- **[TESTING_E2E.md](TESTING_E2E.md)** - End-to-end testing guide
- **[TESTING_PHASE1B.md](TESTING_PHASE1B.md)** - Agent core testing scenarios
- **[PHASE1C_TOOL_BRIDGE.md](PHASE1C_TOOL_BRIDGE.md)** - Tool execution bridge documentation
- **[backend/AGENT_REFERENCE.md](backend/AGENT_REFERENCE.md)** - Agent debugging reference

**Component Documentation:**
- [Backend README](./backend/README.md)
- [Extension README](./extension/README.md)
- [Shared Types README](./shared/README.md)
- [n8n Setup Guide](./infrastructure/n8n-setup.md)

## 🛠️ Development

### Running Services

```bash
# Backend API
npm run dev:backend
# → http://localhost:3000

# PostgreSQL
docker ps | grep meetmind-db
# → localhost:5432

# n8n
docker ps | grep meetmind-n8n
# → http://localhost:5678

# Extension (build in watch mode)
npm run dev:extension
# → extension/dist/
```

### Database Access

```bash
# Connect to PostgreSQL
psql -h localhost -p 5432 -U meetmind -d meetmind

# List tables
\dt

# Check recent interactions
SELECT * FROM interactions ORDER BY created_at DESC LIMIT 10;

# Check tool execution stats
SELECT tool_name, COUNT(*), SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful 
FROM tool_calls 
GROUP BY tool_name;
```

### Logs

```bash
# Backend logs
cd backend && npm run dev:backend
# Watch for [AGENT] prefixed logs

# n8n logs
docker logs -f meetmind-n8n

# PostgreSQL logs
docker logs -f meetmind-db
```

## 🏗️ Project Structure

```
MeetMind/
├── backend/                    # Backend API & Agent
│   ├── src/
│   │   ├── agent/              # Agent core & tool registry
│   │   │   ├── core.ts         # Main execution loop (Phase 1B)
│   │   │   └── toolRegistry.ts # Tool registration
│   │   ├── tools/              # Tool implementations (Phase 1C)
│   │   │   ├── calendar.ts     # Calendar tools
│   │   │   ├── email.ts        # Email tools
│   │   │   ├── drive.ts        # Drive tools
│   │   │   └── memory.ts       # Memory tools
│   │   ├── services/           # External services
│   │   │   ├── openai.ts       # OpenAI API client
│   │   │   ├── n8nClient.ts    # n8n webhook client
│   │   │   └── memoryStore.ts  # Memory operations
│   │   ├── db/                 # Database layer
│   │   │   ├── schema.ts       # PostgreSQL schema
│   │   │   └── queries.ts      # Database queries
│   │   ├── routes/             # API routes
│   │   └── server.ts           # Fastify server
│   └── package.json
│
├── extension/                  # Chrome Extension
│   ├── src/
│   │   ├── popup/              # React UI
│   │   ├── background/         # Service worker
│   │   ├── content/            # Content script
│   │   └── api/                # Backend client
│   └── package.json
│
├── shared/                     # Shared TypeScript types
│   ├── src/types.ts
│   └── package.json
│
├── infrastructure/             # Docker setup
│   ├── n8n-setup.md            # n8n workflow guide
│   └── init.sql                # Database initialization
│
├── docker-compose.yml          # PostgreSQL + n8n
├── package.json                # Root workspace
└── Documentation files (11 total)
```
## 🔧 Tech Stack

**Backend:**
- Node.js 18+ with TypeScript 5.3 (strict mode)
- Fastify 4.26 (web framework)
- OpenAI GPT-4 Turbo (reasoning engine)
- PostgreSQL 15 (database)
- pg (PostgreSQL client)
- Pino (structured logging)

**Frontend:**
- React 18 (UI framework)
- Vite 5 (build tool)
- Chrome Extension Manifest V3
- TypeScript (strict mode)

**Infrastructure:**
- Docker & Docker Compose
- n8n (workflow automation)
- PostgreSQL (audit trail)

**External APIs:**
- OpenAI API (GPT-4 function calling)
- Google Calendar API (via n8n)
- Gmail API (via n8n)
- Google Drive API (via n8n)

## 🎯 Phase Roadmap

### ✅ Phase 1 - Complete
- **1A:** Backend foundation + Extension MVP
- **1B:** Deterministic agent core
- **1C:** Tool execution bridge to n8n

### 🔮 Phase 2 - Planned
- Vector memory (pgvector)
- Semantic memory search
- Enhanced context building
- Meeting intelligence layer

### 🔮 Phase 3 - Planned
- Multi-agent architecture
- Agent specialization
- Advanced tool orchestration
- Proactive suggestions

### 🔮 Phase 4 - Planned
- Production deployment
- User analytics
- Performance optimization
- Scale testing

## 🤝 Contributing

MeetMind is currently in active development. Phase 1 implementation is complete and ready for testing.

### Development Workflow

1. Fork the repository
2. Create feature branch
3. Follow TypeScript strict mode
4. Add tests for new features
5. Update documentation
6. Submit pull request

### Code Style

- TypeScript strict mode enabled
- Comprehensive comments for complex logic
- Structured error handling (never throw in tools)
- Defensive programming (validate all inputs)
- Database logging for all operations

## 📝 License

[Add license information]

## 🙏 Acknowledgments

Built with:
- OpenAI GPT-4 for reasoning
- n8n for workflow automation
- PostgreSQL for reliable storage
- React for clean UI

---

**Status:** ✅ Phase 1 Complete - Ready for n8n setup and testing

**Next Step:** Follow [SETUP.md](SETUP.md) to configure and test the system