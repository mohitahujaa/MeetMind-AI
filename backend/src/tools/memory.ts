/**
 * Memory Tool
 * 
 * Handles memory operations - storing and retrieving information.
 * This is the long-term memory system for the agent.
 * 
 * Capabilities:
 * - Store memories (decisions, action items, notes)
 * - Search memories
 * - Retrieve recent context
 */

import type { ToolDefinition, ToolResult, SearchMemoryParams, StoreMemoryParams } from '@meetmind/shared';
import { storeMemory, searchMemories } from '../services/memoryStore';

/**
 * Tool definition for searching memories
 */
export const searchMemoryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_memory',
    description: 'Search through stored memories, past decisions, action items, and notes. Use this to retrieve relevant context from previous interactions.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find relevant memories',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
        filters: {
          type: 'object',
          description: 'Optional filters for the search. Can include: startDate (ISO 8601), endDate (ISO 8601), type (meeting|decision|action_item|note)',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Execute memory search
 */
export async function executeSearchMemory(
  userId: string,
  params: SearchMemoryParams
): Promise<ToolResult> {
  try {
    if (!params.query) {
      return {
        success: false,
        error: 'Search query is required',
      };
    }

    const memories = await searchMemories(userId, params.query, {
      type: params.filters?.type,
      limit: params.limit || 10,
      startDate: params.filters?.startDate ? new Date(params.filters.startDate) : undefined,
      endDate: params.filters?.endDate ? new Date(params.filters.endDate) : undefined,
    });

    return {
      success: true,
      data: memories,
      metadata: {
        resultCount: memories.length,
        query: params.query,
      },
    };
  } catch (error) {
    console.error('Memory search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error searching memories',
    };
  }
}

/**
 * Tool definition for storing memories
 */
export const storeMemoryTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'store_memory',
    description: 'Store important information as a memory for future reference. Use this to save decisions, action items, or important notes.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Type of memory to store',
          enum: ['meeting', 'decision', 'action_item', 'note'],
        },
        content: {
          type: 'string',
          description: 'The content to store',
        },
        metadata: {
          type: 'object',
          description: 'Optional metadata to attach to the memory',
        },
      },
      required: ['type', 'content'],
    },
  },
};

/**
 * Execute store memory
 */
export async function executeStoreMemory(
  userId: string,
  params: StoreMemoryParams
): Promise<ToolResult> {
  try {
    if (!params.type || !params.content) {
      return {
        success: false,
        error: 'Both type and content are required',
      };
    }

    // Validate type
    const validTypes = ['meeting', 'decision', 'action_item', 'note'];
    if (!validTypes.includes(params.type)) {
      return {
        success: false,
        error: `Invalid memory type. Must be one of: ${validTypes.join(', ')}`,
      };
    }

    const memory = await storeMemory(
      userId,
      params.type,
      params.content,
      params.metadata
    );

    return {
      success: true,
      data: memory,
      metadata: {
        memoryStored: true,
        memoryType: params.type,
      },
    };
  } catch (error) {
    console.error('Store memory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error storing memory',
    };
  }
}
