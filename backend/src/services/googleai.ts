/**
 * Google AI Service
 * 
 * Handles all interactions with the Google Generative AI API (Gemini).
 * Alternative to OpenAI service with the same interface.
 * 
 * Responsibilities:
 * - Create chat completions with function calling
 * - Manage conversation context
 * - Convert between OpenAI and Google AI formats
 */

import { 
  GoogleGenerativeAI, 
  SchemaType,
  type FunctionDeclaration,
  type Content,
  type Part
} from '@google/generative-ai';
import type { OpenAIMessage, ToolDefinition, ToolCall } from '@meetmind/shared';

// Initialize Google AI client
let genAI: GoogleGenerativeAI | null = null;

function getGoogleAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_AI_API_KEY || '';
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Agent response from Google AI
 */
export interface AgentDecision {
  type: 'final_response' | 'tool_calls' | 'clarification';
  message?: string;
  toolCalls?: ToolCall[];
}

/**
 * Convert OpenAI tool definitions to Google AI function declarations
 */
function convertToolsToGoogleFormat(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map(tool => {
    const params = tool.function.parameters;
    
    // Convert OpenAI schema to Google AI schema
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    if (params.properties) {
      for (const [key, value] of Object.entries(params.properties)) {
        const prop = value as any;
        properties[key] = {
          type: convertTypeToGoogle(prop.type),
          description: prop.description,
        };
        
        // Handle array items - REQUIRED by Google AI
        if (prop.type === 'array') {
          properties[key].items = {
            type: convertTypeToGoogle(prop.items?.type || 'string'),
          };
        }
      }
    }
    
    if (params.required) {
      required.push(...params.required);
    }
    
    return {
      name: tool.function.name,
      description: tool.function.description,
      parameters: {
        type: SchemaType.OBJECT,
        properties,
        required,
      },
    };
  });
}

/**
 * Convert OpenAI type to Google AI type
 */
function convertTypeToGoogle(type: string): SchemaType {
  switch (type) {
    case 'string':
      return SchemaType.STRING;
    case 'number':
    case 'integer':
      return SchemaType.NUMBER;
    case 'boolean':
      return SchemaType.BOOLEAN;
    case 'array':
      return SchemaType.ARRAY;
    case 'object':
      return SchemaType.OBJECT;
    default:
      return SchemaType.STRING;
  }
}

/**
 * Convert OpenAI messages to Google AI format
 */
function convertMessagesToGoogleFormat(messages: OpenAIMessage[]): Content[] {
  const history: Content[] = [];
  
  // Track tool_call_id to function name mapping
  const toolCallMap: Record<string, string> = {};
  
  for (const msg of messages) {
    if (msg.role === 'system') {
      // Google doesn't have system role - prepend to first user message
      continue;
    }
    
    if (msg.role === 'tool') {
      // Convert tool response to function response
      const toolCallId = (msg as any).tool_call_id;
      const functionName = toolCallMap[toolCallId] || 'unknown';
      
      console.log(`[GOOGLE AI] Converting tool response - tool_call_id: ${toolCallId}, function: ${functionName}`);
      
      let responseData;
      try {
        responseData = JSON.parse(msg.content || '{}');
        console.log(`[GOOGLE AI] Tool result for ${functionName}:`, JSON.stringify(responseData).substring(0, 200));
      } catch (e) {
        console.warn(`[GOOGLE AI] Failed to parse tool response: ${msg.content}`);
        responseData = { error: 'Failed to parse tool response' };
      }
      
      history.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: functionName,
            response: responseData,
          },
        }],
      });
    } else if (msg.role === 'assistant') {
      // Check if this is a function call
      const toolCalls = (msg as any).tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Store tool_call_id to function name mapping
        for (const tc of toolCalls) {
          toolCallMap[tc.id] = tc.function.name;
          console.log(`[GOOGLE AI] Mapping tool_call_id ${tc.id} to function ${tc.function.name}`);
        }
        
        history.push({
          role: 'model',
          parts: toolCalls.map((tc: any) => ({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            },
          })),
        });
      } else {
        history.push({
          role: 'model',
          parts: [{ text: msg.content || '' }],
        });
      }
    } else if (msg.role === 'user') {
      history.push({
        role: 'user',
        parts: [{ text: msg.content || '' }],
      });
    }
  }
  
  console.log(`[GOOGLE AI] Converted ${messages.length} messages to ${history.length} history entries`);
  
  return history;
}

/**
 * Call Google AI with messages and tool definitions
 * Returns the agent's decision: final response, tool calls, or clarification request
 */
export async function callGoogleAI(
  messages: OpenAIMessage[],
  tools?: ToolDefinition[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AgentDecision> {
  const client = getGoogleAI();
  const model = process.env.GOOGLE_AI_MODEL || 'gemini-1.5-flash';

  try {
    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const systemInstruction = systemMessage?.content || undefined;
    
    // Convert tools to Google format
    const googleTools = tools && tools.length > 0 
      ? [{ functionDeclarations: convertToolsToGoogleFormat(tools) }]
      : undefined;
    
    // Initialize model with tools
    const generativeModel = client.getGenerativeModel({
      model,
      systemInstruction,
      tools: googleTools,
    });
    
    // Convert message history
    const history = convertMessagesToGoogleFormat(messages.filter(m => m.role !== 'system'));
    
    // Get the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }
    
    // Start chat with history (excluding last message)
    const historyWithoutLast = history.slice(0, -1);
    const chat = generativeModel.startChat({
      history: historyWithoutLast.length > 0 ? historyWithoutLast : undefined,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens,
      },
    });
    
    // Log conversation for debugging
    console.log('[GOOGLE AI] Sending message, history length:', historyWithoutLast.length);
    console.log('[GOOGLE AI] Last user message:', lastUserMessage.content?.substring(0, 200));
    
    // Send the last message
    const result = await chat.sendMessage(lastUserMessage.content || '');
    const response = result.response;
    
    console.log('[GOOGLE AI] Response received, candidates:', response.candidates?.length || 0);
    
    // Check for function calls
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      console.log('[GOOGLE AI] Function calls requested:', functionCalls.map(fc => fc.name).join(', '));
      
      // Convert to OpenAI-style tool calls
      const toolCalls: ToolCall[] = functionCalls.map((fc, index) => ({
        id: `call_${Date.now()}_${index}`,
        type: 'function' as const,
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      }));
      
      return {
        type: 'tool_calls',
        toolCalls,
      };
    }
    
    // Get text response
    const text = response.text();
    if (text) {
      console.log('[GOOGLE AI] Text response:', text.substring(0, 200));
      return {
        type: 'final_response',
        message: text,
      };
    }
    
    // Fallback
    console.log('[GOOGLE AI] No function calls or text, using fallback');
    return {
      type: 'final_response',
      message: 'I apologize, but I was unable to process your request.',
    };
  } catch (error) {
    console.error('[GOOGLE AI] API error:', error);
    // Log more details
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('[GOOGLE AI] Error message:', error.message);
    }
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('[GOOGLE AI] Error response:', JSON.stringify(error.response, null, 2));
    }
    throw new Error(`Failed to get response from Google AI: ${error instanceof Error ? error.message : String(error)}`);
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
