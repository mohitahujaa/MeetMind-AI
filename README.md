# MeetMind

**An AI-powered workspace execution agent that eliminates context switching.**

MeetMind is not a chatbot or just another meeting summarizer — it's an intelligent execution layer that enables you to manage your entire workspace from a single interface. Schedule meetings, send emails, search files, and execute cross-application workflows without leaving your current screen.

---

## What MeetMind Does

MeetMind acts as your personal AI workspace assistant with the ability to:

- **📅 Manage Calendar** - Create events, check schedules, coordinate meetings
- **📧 Handle Email** - Send messages, draft responses, manage communications
- **📂 Search Files** - Find documents across Google Drive instantly
- **🔗 Execute Workflows** - Chain multiple actions together intelligently
- **💭 Maintain Context** - Remember previous interactions and preferences
- **🤖 Take Action** - Not just suggestions — real execution with your permission

---

## Core Architecture

### Single-Agent Execution Loop

MeetMind uses a deterministic reasoning loop:

1. **Receive** user intent + current context
2. **Reason** using LLM (with tool schema awareness)
3. **Execute** tools via n8n automation layer
4. **Persist** interactions and results
5. **Respond** with actionable outcomes

### Technology Stack

#### Frontend
- **Chrome Extension** (Manifest V3)
- **React** + **Vite**
- Single-command interface overlay

#### Backend
- **Node.js** + **Fastify**
- **TypeScript** (strict mode)
- Multi-LLM abstraction layer

#### AI Layer
- **Google Gemini** (primary, free tier)
- **OpenAI/SambaNova** (via OpenRouter)
- **Ollama** (local CPU inference)

#### Automation
- **n8n** (self-hosted via Docker)
- OAuth-based Google Workspace integration
- Webhook-driven tool execution

#### Database
- **PostgreSQL** (via Docker)
- Structured logging of:
  - User sessions
  - Interactions
  - Tool calls
  - Memories

---

## Key Features

### Context-Aware Execution

```
User: "Schedule a meeting with the team tomorrow at 2pm"
MeetMind: 
  → Checks calendar for conflicts
  → Creates event
  → Returns confirmation with event link
```

### Cross-Tool Intelligence

```
User: "Find my Python certificate and email it to john@example.com"
MeetMind:
  → Searches Google Drive
  → Finds certificate
  → Composes email with attachment
  → Sends via Gmail
```

### Memory Persistence

MeetMind remembers:
- Previous conversations
- User preferences
- Executed actions
- Tool call history

---

## Project Structure

```
MeetMind/
├── extension/          # Chrome extension (React UI)
│   ├── src/
│   └── dist/          # Built extension
├── backend/           # Node.js Fastify server
│   ├── src/
│   │   ├── agent/     # Core reasoning loop
│   │   ├── services/  # LLM providers (Ollama, Gemini, OpenAI)
│   │   ├── tools/     # Calendar, Email, Drive
│   │   └── db/        # PostgreSQL integration
│   └── dist/
├── shared/            # Shared TypeScript types
├── database/          # PostgreSQL schema + migrations
├── docker/            # Docker Compose setup
└── n8n/              # n8n workflow configurations
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Docker Desktop**
- **Chrome Browser**
- Google AI Studio API key (free) or OpenRouter API key

### Installation

1. **Clone & Install**
   ```bash
   git clone <your-repo>
   cd MeetMind
   npm install
   cd backend && npm install
   cd ../extension && npm install
   cd ../shared && npm install && npm run build
   ```

2. **Configure Environment**
   ```bash
   # In backend/.env
   LLM_PROVIDER=googleai
   GOOGLE_AI_API_KEY=your-api-key
   GOOGLE_AI_MODEL=gemini-2.0-flash
   
   N8N_HOST=http://localhost:5678
   N8N_API_KEY=your-n8n-api-key
   
   DATABASE_URL=postgresql://meetmind:password@localhost:5432/meetmind
   ```

3. **Start Infrastructure**
   ```bash
   docker-compose up -d  # Starts PostgreSQL + n8n
   ```

4. **Run Backend**
   ```bash
   cd backend
   npm run dev
   ```

5. **Build & Load Extension**
   ```bash
   cd extension
   npm run build
   # Load `extension/dist/` in chrome://extensions
   ```

---

## LLM Provider Configuration

MeetMind supports multiple LLM providers via a unified abstraction layer.

### Option 1: Google Gemini (Recommended - Free)

```env
LLM_PROVIDER=googleai
GOOGLE_AI_API_KEY=your-key-from-ai.google.dev
GOOGLE_AI_MODEL=gemini-2.0-flash
```

### Option 2: OpenAI/SambaNova/OpenRouter

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4
OPENAI_BASE_URL=https://api.openai.com/v1  # or OpenRouter URL
```

### Option 3: Ollama (Local CPU)

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

Switch providers by changing `LLM_PROVIDER` in `.env` — no code changes required.

---

## Tool Integration (n8n)

MeetMind uses **n8n** as the automation layer for real-world actions.

### Available Tools

| Tool | Action | Endpoint |
|------|--------|----------|
| **Calendar** | `create_event` | `/webhook/calendar/create-event` |
| **Calendar** | `get_events` | `/webhook/calendar/get-events` |
| **Email** | `send_email` | `/webhook/email/send` |
| **Drive** | `search_drive` | `/webhook/drive/search` |
| **Drive** | `fetch_file` | `/webhook/drive/fetch-file` |

### n8n Workflow Setup

1. Access n8n at `http://localhost:5678`
2. Import workflows from `n8n/workflows/`
3. Configure Google OAuth credentials
4. Activate workflows
5. Copy webhook URLs to backend environment

---

## Architecture Design

### Agent Core (`backend/src/agent/core.ts`)

- **Deterministic loop** with max 5 iterations
- **Tool call deduplication** to prevent redundant API calls
- **Structured logging** of all decisions and actions
- **Error handling** with fallback responses

### LLM Abstraction (`backend/src/services/llm.ts`)

- Provider-agnostic interface
- Function calling normalization across providers
- Streaming support (future)
- Model switching without code changes

### Tool Execution Contract

```typescript
interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}
```

All tools return this normalized format regardless of n8n response structure.

---

## Development Roadmap

### Phase 1 (Current)
- ✅ Single-agent reasoning loop
- ✅ Multi-LLM support (Ollama, Gemini, OpenAI)
- ✅ Calendar, Email, Drive integration
- ✅ Chrome extension UI
- ✅ PostgreSQL persistence

### Phase 2 (Planned)
- 🔲 Multi-user OAuth support
- 🔲 Vector embeddings for semantic memory
- 🔲 Meeting transcription + summarization
- 🔲 Proactive task suggestions
- 🔲 Cross-session intelligence

### Phase 3 (Future)
- 🔲 Multi-agent orchestration
- 🔲 Custom workflow builder
- 🔲 Third-party integrations (Slack, Notion, etc.)
- 🔲 SaaS deployment-ready architecture

---

## Contributing

MeetMind is designed with modularity in mind:

- **Add new tools**: Extend `backend/src/tools/`
- **Add LLM providers**: Implement `ILLMProvider` interface
- **Extend UI**: Modify `extension/src/`
- **Database migrations**: Add to `database/migrations/`

---

## License

MIT License - See `LICENSE` file for details.

---

## Contact

Built as a startup-grade AI workspace agent.

For questions or collaboration: [Your Contact Info]

---

**MeetMind** — Execute your workspace, not just your prompts.