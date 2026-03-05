/**
 * Shared Type Definitions for MeetMind
 * 
 * This file contains all shared types used across the backend and extension.
 * These types ensure type safety and consistent contracts between components.
 */

// ============================================================================
// USER & SESSION TYPES
// ============================================================================

/**
 * Represents a user in the system
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents an active session
 */
export interface Session {
  id: string;
  userId: string;
  startedAt: Date;
  lastActivityAt: Date;
  context: SessionContext;
}

/**
 * Context captured from the user's current environment
 */
export interface SessionContext {
  url?: string;
  pageTitle?: string;
  selectedText?: string;
  tabs?: TabContext[];
  meetingMetadata?: MeetingMetadata;
}

/**
 * Browser tab context
 */
export interface TabContext {
  url: string;
  title: string;
  active: boolean;
}

/**
 * Meeting-specific metadata
 */
export interface MeetingMetadata {
  meetingId?: string;
  title?: string;
  participants?: string[];
  startTime?: Date;
  endTime?: Date;
  platform?: 'meet' | 'zoom' | 'teams' | 'other';
}

// ============================================================================
// AGENT REQUEST & RESPONSE TYPES
// ============================================================================

/**
 * Request sent from extension to backend agent
 */
export interface AgentRequest {
  sessionId: string;
  userId: string;
  query: string;
  context: SessionContext;
  conversationHistory?: ConversationMessage[];
}

/**
 * Response from backend agent to extension
 */
export interface AgentResponse {
  status: 'success' | 'error' | 'requires_confirmation' | 'partial_success';
  message: string;
  actions?: ExecutedAction[];
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  conversationHistory?: ConversationMessage[];
}

/**
 * Individual message in conversation history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

/**
 * Represents an action that was executed
 */
export interface ExecutedAction {
  toolName: string;
  parameters: Record<string, any>;
  result: any;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

// ============================================================================
// TOOL TYPES
// ============================================================================

/**
 * Tool definition for LLM function calling
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}

/**
 * Individual tool parameter schema
 */
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

/**
 * Tool call from LLM
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// SPECIFIC TOOL PARAMETER TYPES
// ============================================================================

/**
 * Parameters for creating a calendar event
 */
export interface CreateCalendarEventParams {
  summary: string;
  description?: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  attendees?: string[];
  location?: string;
}

/**
 * Parameters for sending an email
 */
export interface SendEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
}

/**
 * Parameters for fetching a Drive file
 */
export interface FetchDriveFileParams {
  fileId?: string;
  fileName?: string;
  mimeType?: string;
}

/**
 * Parameters for searching memory
 */
export interface SearchMemoryParams {
  query: string;
  limit?: number;
  filters?: {
    startDate?: string;
    endDate?: string;
    type?: 'meeting' | 'decision' | 'action_item';
  };
}

/**
 * Parameters for storing memory
 */
export interface StoreMemoryParams {
  type: 'meeting' | 'decision' | 'action_item' | 'note';
  content: string;
  metadata?: Record<string, any>;
  relatedTo?: string[]; // IDs of related memories
}

/**
 * Parameters for summarizing text
 */
export interface SummarizeTextParams {
  text: string;
  maxLength?: number;
  format?: 'bullet_points' | 'paragraph' | 'tldr';
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Database record for interactions
 */
export interface InteractionRecord {
  id: string;
  sessionId: string;
  userId: string;
  query: string;
  response: string;
  status: 'success' | 'error';
  createdAt: Date;
}

/**
 * Database record for tool calls
 */
export interface ToolCallRecord {
  id: string;
  interactionId: string;
  toolName: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  errorMessage?: string;
  executedAt: Date;
}

/**
 * Database record for meetings
 */
export interface MeetingRecord {
  id: string;
  userId: string;
  title: string;
  participants: string[];
  startTime: Date;
  endTime?: Date;
  summary?: string;
  transcript?: string;
  actionItems?: string[];
  decisions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database record for memories
 */
export interface MemoryRecord {
  id: string;
  userId: string;
  type: 'meeting' | 'decision' | 'action_item' | 'note';
  content: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// N8N INTEGRATION TYPES
// ============================================================================

/**
 * Request sent to n8n webhook
 */
export interface N8nWebhookRequest {
  action: string;
  parameters: Record<string, any>;
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Response from n8n webhook
 */
export interface N8nWebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// OPENAI TYPES
// ============================================================================

/**
 * OpenAI chat message format
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * OpenAI chat completion request
 */
export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: ToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
}
