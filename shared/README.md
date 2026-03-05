# Shared Types Package

TypeScript type definitions shared across MeetMind packages.

## Purpose

This package provides type safety and consistent contracts between:
- Backend
- Chrome Extension
- Future frontend applications

## Usage

```typescript
import type {
  AgentRequest,
  AgentResponse,
  ToolDefinition,
  SessionContext,
  // ... other types
} from '@meetmind/shared';
```

## Type Categories

### User & Session Types
- `User`: User account information
- `Session`: Active session data
- `SessionContext`: Context captured from browser
- `MeetingMetadata`: Meeting-specific context

### Agent Types
- `AgentRequest`: Request sent to agent
- `AgentResponse`: Response from agent
- `ConversationMessage`: Chat message format
- `ExecutedAction`: Record of tool execution

### Tool Types
- `ToolDefinition`: Tool schema for OpenAI
- `ToolCall`: Tool invocation from LLM
- `ToolResult`: Result from tool execution
- Tool-specific parameter types

### Database Types
- `InteractionRecord`: Logged interaction
- `ToolCallRecord`: Logged tool call
- `MeetingRecord`: Meeting data
- `MemoryRecord`: Stored memory

### Integration Types
- `N8nWebhookRequest`: Request to n8n
- `N8nWebhookResponse`: Response from n8n
- `OpenAIMessage`: OpenAI chat format

## Development

```bash
# Build types
npm run build

# Watch mode
npm run watch
```

## Adding New Types

1. Add type definitions to `src/types.ts`
2. Export from `src/index.ts`
3. Rebuild: `npm run build`
4. Types automatically available in backend and extension

## Type Safety

All types are strict TypeScript types with:
- Required vs optional fields clearly marked
- Enum types for fixed sets of values
- Proper date handling
- JSON-serializable structures
