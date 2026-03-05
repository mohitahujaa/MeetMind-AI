/**
 * OpenAI Service
 * 
 * Handles all interactions with the OpenAI API.
 * This is the reasoning engine for the agent.
 * 
 * Responsibilities:
 * - Create chat completions with function calling
 * - Manage conversation context
 * - Handle streaming (future enhancement)
 */

import OpenAI from 'openai';
import type { OpenAIMessage, ToolDefinition, ToolCall } from '@meetmind/shared';

// Initialize OpenAI client (supports OpenRouter via base URL)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  defaultHeaders: process.env.OPENAI_BASE_URL?.includes('openrouter') 
    ? {
        'HTTP-Referer': 'https://meetmind.dev',
        'X-Title': 'MeetMind',
      }
    : undefined,
});

/**
 * Agent response from OpenAI
 */
export interface AgentDecision {
  type: 'final_response' | 'tool_calls' | 'clarification';
  message?: string;
  toolCalls?: ToolCall[];
}

/**
 * Call OpenAI with messages and tool definitions
 * Returns the agent's decision: final response, tool calls, or clarification request
 */
export async function callOpenAI(
  messages: OpenAIMessage[],
  tools?: ToolDefinition[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AgentDecision> {
  const client = openai;

  const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

  try {
    console.log(`[OpenAI] Calling model: ${model}`);
    console.log(`[OpenAI] Messages count: ${messages.length}`);
    console.log(`[OpenAI] Tools count: ${tools?.length || 0}`);
    console.log(`[OpenAI] Making API request...`);
    
    const completion = await client.chat.completions.create({
      model,
      messages: messages as any, // Type cast needed for OpenAI SDK compatibility
      tools,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    });
    
    console.log(`[OpenAI] Response received successfully`);

    // Debug: Log if choices is missing
    if (!completion.choices || completion.choices.length === 0) {
      console.error('OpenAI response missing choices:', JSON.stringify(completion, null, 2));
      throw new Error('Invalid response from OpenAI: missing choices array');
    }

    const choice = completion.choices[0];

    if (!choice) {
      throw new Error('No response from OpenAI');
    }

    // Check if the model wants to call tools
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      return {
        type: 'tool_calls',
        toolCalls: choice.message.tool_calls as ToolCall[],
      };
    }

    // Check if we have a message
    if (choice.message.content) {
      // Determine if this is a final response or clarification
      // TODO: Enhance this logic to detect clarification requests
      return {
        type: 'final_response',
        message: choice.message.content,
      };
    }

    // Fallback
    return {
      type: 'final_response',
      message: 'I apologize, but I was unable to process your request.',
    };
  } catch (error) {
    console.error('[OpenAI] API error:', error);
    if (error instanceof Error) {
      console.error('[OpenAI] Error message:', error.message);
      console.error('[OpenAI] Error stack:', error.stack);
    }
    throw new Error(`Failed to get response from OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a system message for the agent
 */
export function createSystemMessage(context?: string): OpenAIMessage {
  const baseSystemPrompt = `You are MeetMind, an AI workspace execution agent.

Your purpose is to help users perform actions across their workspace (calendar, email, drive, meetings) without context switching.

Key capabilities:
- Create calendar events
- Send emails
- Access Google Drive files
- Summarize meetings
- Store and retrieve memories
- Make decisions and take actions

When a user asks you to do something:
1. Understand their intent
2. Determine which tools you need
3. Call the appropriate tools
4. Provide clear confirmation of what was done

Always be:
- Precise and clear
- Action-oriented
- Context-aware
- Professional but friendly

Current context: ${context || 'No additional context'}

Remember: You can execute actions. Don't just suggest - DO.`;

  return {
    role: 'system',
    content: baseSystemPrompt,
  };
}

/**
 * Convert conversation history to OpenAI message format
 */
export function convertToOpenAIMessages(
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>
): OpenAIMessage[] {
  return conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
