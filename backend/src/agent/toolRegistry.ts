/**
 * Tool Registry
 * 
 * Central registry of all available tools.
 * Manages tool definitions and execution routing.
 * 
 * Responsibilities:
 * - Register all tools
 * - Provide tool definitions for OpenAI
 * - Route tool calls to appropriate executors
 * - Handle tool errors uniformly
 */

import type { ToolDefinition, ToolResult } from '@meetmind/shared';

// Import tool definitions
import {
  createCalendarEventTool,
  getCalendarEventsTool,
  executeCreateCalendarEvent,
  executeGetCalendarEvents,
} from '../tools/calendar';

import {
  sendEmailTool,
  executeSendEmail,
} from '../tools/email';

import {
  fetchDriveFileTool,
  searchDriveTool,
  executeFetchDriveFile,
  executeSearchDrive,
} from '../tools/drive';

import {
  searchMemoryTool,
  storeMemoryTool,
  executeSearchMemory,
  executeStoreMemory,
} from '../tools/memory';

/**
 * Tool executor function type
 */
type ToolExecutor = (userId: string, params: any) => Promise<ToolResult>;

/**
 * Registry of all available tools
 */
interface ToolRegistry {
  definitions: ToolDefinition[];
  executors: Map<string, ToolExecutor>;
}

/**
 * Initialize and return the tool registry
 */
export function getToolRegistry(): ToolRegistry {
  const registry: ToolRegistry = {
    definitions: [],
    executors: new Map(),
  };

  // Register calendar tools
  registry.definitions.push(createCalendarEventTool);
  registry.executors.set('create_calendar_event', executeCreateCalendarEvent);

  registry.definitions.push(getCalendarEventsTool);
  registry.executors.set('get_calendar_events', executeGetCalendarEvents);

  // Register email tools
  registry.definitions.push(sendEmailTool);
  registry.executors.set('send_email', executeSendEmail);

  // Register drive tools
  registry.definitions.push(fetchDriveFileTool);
  registry.executors.set('fetch_drive_file', executeFetchDriveFile);

  registry.definitions.push(searchDriveTool);
  registry.executors.set('search_drive', executeSearchDrive);

  // Register memory tools
  registry.definitions.push(searchMemoryTool);
  registry.executors.set('search_memory', executeSearchMemory);

  registry.definitions.push(storeMemoryTool);
  registry.executors.set('store_memory', executeStoreMemory);

  return registry;
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  userId: string,
  parameters: any
): Promise<ToolResult> {
  const registry = getToolRegistry();
  const executor = registry.executors.get(toolName);

  if (!executor) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  try {
    return await executor(userId, parameters);
  } catch (error) {
    console.error(`Tool execution error for ${toolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown tool execution error',
    };
  }
}

/**
 * Get all tool definitions for OpenAI
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  const registry = getToolRegistry();
  return registry.definitions;
}

/**
 * Get list of available tool names
 */
export function getAvailableToolNames(): string[] {
  const registry = getToolRegistry();
  return Array.from(registry.executors.keys());
}

/**
 * Check if a tool exists
 */
export function toolExists(toolName: string): boolean {
  const registry = getToolRegistry();
  return registry.executors.has(toolName);
}
