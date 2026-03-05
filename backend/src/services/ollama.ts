/**
 * Ollama Service
 * 
 * Handles all interactions with local Ollama models.
 * Uses prompt engineering to simulate function calling since
 * smaller models don't have native OpenAI-style function calling.
 * 
 * Responsibilities:
 * - Format messages for Ollama's chat format
 * - Inject tool definitions as prompt instructions
 * - Parse responses for tool calls (JSON extraction)
 * - Handle streaming (future enhancement)
 */

import axios from 'axios';
import type { OpenAIMessage, ToolDefinition, ToolCall } from '@meetmind/shared';

// Ollama API endpoint
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3:latest';

/**
 * Agent response from Ollama
 */
export interface AgentDecision {
  type: 'final_response' | 'tool_calls' | 'clarification';
  message?: string;
  toolCalls?: ToolCall[];
}

/**
 * Format tools as a detailed prompt instruction
 * Since Ollama doesn't have native function calling, we use structured prompts
 */
function formatToolsAsPrompt(tools: ToolDefinition[]): string {
  if (!tools || tools.length === 0) {
    return '';
  }

  const toolDescriptions = tools.map((tool) => {
    const functionDef = tool.function;
    const params = Object.entries(functionDef.parameters?.properties || {})
      .map(([key, value]: [string, any]) => {
        const required = functionDef.parameters?.required?.includes(key) ? ' (required)' : ' (optional)';
        return `    - ${key}${required}: ${value.description || value.type}`;
      })
      .join('\n');

    return `
**${functionDef.name}**
${functionDef.description}
Parameters:
${params || '    No parameters'}`;
  });

  return `
=== AVAILABLE TOOLS ===

You have access to the following tools. When you need to use a tool, respond with ONLY a JSON object in this EXACT format:

{
  "tool_call": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1",
      "param2": "value2"
    }
  }
}

DO NOT include any other text before or after the JSON. Just the JSON object.

Available tools:
${toolDescriptions.join('\n')}

=== INSTRUCTIONS ===

1. If the user's request requires a tool, respond with the JSON tool call format above
2. If you don't need a tool, respond normally with a helpful text message
3. Only call ONE tool at a time
4. Make sure all required parameters are included

======================
`;
}

/**
 * Format messages for Ollama chat API
 */
function formatMessagesForOllama(
  messages: OpenAIMessage[],
  tools?: ToolDefinition[]
): Array<{ role: string; content: string }> {
  const formattedMessages: Array<{ role: string; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Inject tool definitions into system message
      const toolPrompt = tools && tools.length > 0 ? formatToolsAsPrompt(tools) : '';
      formattedMessages.push({
        role: 'system',
        content: msg.content + '\n\n' + toolPrompt,
      });
    } else if (msg.role === 'user') {
      formattedMessages.push({
        role: 'user',
        content: msg.content || '',
      });
    } else if (msg.role === 'assistant') {
      // Check if this is a tool call response
      const toolCalls = (msg as any).tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Format tool calls as JSON for the model to see
        const toolCallsJson = toolCalls.map((tc: ToolCall) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));
        formattedMessages.push({
          role: 'assistant',
          content: JSON.stringify({ tool_call: toolCallsJson[0] }, null, 2),
        });
      } else {
        formattedMessages.push({
          role: 'assistant',
          content: msg.content || '',
        });
      }
    } else if (msg.role === 'tool') {
      // Format tool results as user messages (Ollama doesn't have 'tool' role)
      const toolResult = msg.content || '{}';
      formattedMessages.push({
        role: 'user',
        content: `Tool execution result:\n${toolResult}\n\nBased on this result, provide a helpful response to the user.`,
      });
    }
  }

  return formattedMessages;
}

/**
 * Extract tool call from Ollama response
 * Tries multiple strategies to find JSON tool call
 */
function extractToolCall(response: string): ToolCall | null {
  // Strategy 1: Try to parse entire response as JSON
  try {
    const parsed = JSON.parse(response.trim());
    if (parsed.tool_call && parsed.tool_call.name) {
      return {
        id: `ollama_${Date.now()}_0`,
        type: 'function',
        function: {
          name: parsed.tool_call.name,
          arguments: JSON.stringify(parsed.tool_call.arguments || {}),
        },
      };
    }
  } catch (e) {
    // Not pure JSON, try other strategies
  }

  // Strategy 2: Extract JSON from markdown code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.tool_call && parsed.tool_call.name) {
        return {
          id: `ollama_${Date.now()}_0`,
          type: 'function',
          function: {
            name: parsed.tool_call.name,
            arguments: JSON.stringify(parsed.tool_call.arguments || {}),
          },
        };
      }
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find any JSON object in the response
  const jsonMatch = response.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool_call && parsed.tool_call.name) {
        return {
          id: `ollama_${Date.now()}_0`,
          type: 'function',
          function: {
            name: parsed.tool_call.name,
            arguments: JSON.stringify(parsed.tool_call.arguments || {}),
          },
        };
      }
    } catch (e) {
      // No valid tool call found
    }
  }

  return null;
}

/**
 * Call Ollama with messages and tool definitions
 * Returns the agent's decision: final response, tool calls, or clarification request
 */
export async function callOllama(
  messages: OpenAIMessage[],
  tools?: ToolDefinition[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AgentDecision> {
  const ollamaUrl = `${OLLAMA_BASE_URL}/api/chat`;

  try {
    console.log(`[OLLAMA] Calling ${OLLAMA_MODEL} with ${messages.length} messages`);
    console.log(`[OLLAMA] Available tools: ${tools?.length || 0}`);

    // Format messages for Ollama
    const formattedMessages = formatMessagesForOllama(messages, tools);

    // Call Ollama chat API
    const response = await axios.post(
      ollamaUrl,
      {
        model: OLLAMA_MODEL,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2000,
        },
      },
      {
        timeout: 0, // No timeout - let Ollama take as long as needed
      }
    );

    const rawResponse = response.data.message?.content || '';
    console.log('[OLLAMA] Raw response:', rawResponse.substring(0, 200));

    // Try to extract tool call
    const toolCall = extractToolCall(rawResponse);

    if (toolCall) {
      console.log('[OLLAMA] Detected tool call:', toolCall.function.name);
      return {
        type: 'tool_calls',
        toolCalls: [toolCall],
      };
    }

    // No tool call, treat as final response
    console.log('[OLLAMA] No tool call detected, treating as final response');
    return {
      type: 'final_response',
      message: rawResponse.trim(),
    };
  } catch (error: any) {
    console.error('[OLLAMA] API error:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running on http://localhost:11434');
    }
    
    throw new Error(`Failed to get response from Ollama: ${error.message}`);
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
2. Determine which tools you need (if any)
3. If you need a tool, respond with the EXACT JSON format shown in the tools section
4. If you don't need a tool, provide a clear, helpful response
5. After tool execution, interpret the results and give a clear summary

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
