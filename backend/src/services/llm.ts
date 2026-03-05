/**
 * LLM Service Factory
 * 
 * Provides a unified interface for all LLM providers.
 * Allows seamless switching between OpenAI, Google AI, and Ollama
 * via environment variable configuration.
 * 
 * Usage:
 *   import { callLLM, createSystemMessage } from './services/llm';
 * 
 * Configuration:
 *   Set LLM_PROVIDER=openai|googleai|ollama in .env
 */

import type { OpenAIMessage, ToolDefinition } from '@meetmind/shared';
import { callOpenAI } from './openai';
import { callGoogleAI } from './googleai';
import { callOllama } from './ollama';
import type { AgentDecision as OpenAIDecision } from './openai';
import type { AgentDecision as GoogleAIDecision } from './googleai';
import type { AgentDecision as OllamaDecision } from './ollama';

/**
 * Unified AgentDecision type
 */
export type AgentDecision = OpenAIDecision | GoogleAIDecision | OllamaDecision;

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'googleai' | 'ollama';

/**
 * Get the active LLM provider from environment
 */
export function getActiveProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
  
  if (provider === 'openai' || provider === 'googleai' || provider === 'ollama') {
    return provider;
  }
  
  console.warn(`[LLM] Invalid LLM_PROVIDER: ${provider}, falling back to ollama`);
  return 'ollama';
}

/**
 * Call the active LLM provider
 */
export async function callLLM(
  messages: OpenAIMessage[],
  tools?: ToolDefinition[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AgentDecision> {
  const provider = getActiveProvider();
  
  console.log(`[LLM] Using provider: ${provider}`);
  
  switch (provider) {
    case 'openai':
      return callOpenAI(messages, tools, options);
    
    case 'googleai':
      return callGoogleAI(messages, tools, options);
    
    case 'ollama':
      return callOllama(messages, tools, options);
    
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

/**
 * Create a system message for the agent
 * 
 * This provides the core identity and instructions for MeetMind.
 * Context from memory is injected here.
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
3. Use the appropriate tool with correct parameters
4. CRITICAL: After tools execute, you MUST present the actual results to the user
   - DO NOT say "I'm searching" or "I'll get back to you" 
   - DO present the actual data returned by the tools
   - Example: If search_drive returns files, LIST THEM in your response

Always be:
- Precise and clear
- Action-oriented
- Context-aware
- Professional but friendly
- Results-focused: Show users what you found, don't just acknowledge the search

Current context: ${context || 'No additional context'}

Remember: You can execute actions. Don't just suggest - DO. And when tools return data, PRESENT IT.`;

  return {
    role: 'system',
    content: baseSystemPrompt,
  };
}

/**
 * Get provider-specific information for debugging
 */
export function getProviderInfo(): {
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
} {
  const provider = getActiveProvider();
  
  switch (provider) {
    case 'openai':
      return {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      };
    
    case 'googleai':
      return {
        provider: 'googleai',
        model: process.env.GOOGLE_AI_MODEL || 'gemini-1.5-flash',
      };
    
    case 'ollama':
      return {
        provider: 'ollama',
        model: process.env.OLLAMA_MODEL || 'llama3:latest',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      };
  }
}
