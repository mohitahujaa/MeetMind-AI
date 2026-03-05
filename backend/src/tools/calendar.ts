/**
 * Calendar Tool
 * 
 * Handles calendar-related operations.
 * Integrates with n8n for Google Calendar API access.
 * 
 * Capabilities:
 * - Create calendar events
 * - Get upcoming events
 * - Parse natural language time expressions
 */

import type { ToolDefinition, ToolResult, CreateCalendarEventParams } from '@meetmind/shared';
import { createCalendarEvent as n8nCreateEvent, getCalendarEvents } from '../services/n8nClient';

/**
 * Tool definition for creating calendar events
 */
export const createCalendarEventTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_calendar_event',
    description: 'Create a new event in Google Calendar. Use this when the user wants to schedule a meeting or create a calendar entry.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'The title or summary of the event (e.g., "Team Sync Meeting")',
        },
        description: {
          type: 'string',
          description: 'Optional detailed description of the event',
        },
        startTime: {
          type: 'string',
          description: 'Start time in ISO 8601 format (e.g., "2024-03-15T10:00:00Z")',
        },
        endTime: {
          type: 'string',
          description: 'End time in ISO 8601 format (e.g., "2024-03-15T11:00:00Z")',
        },
        location: {
          type: 'string',
          description: 'Optional location or meeting link',
        },
      },
      required: ['summary', 'startTime', 'endTime'],
    },
  },
};

/**
 * Execute calendar event creation
 */
export async function executeCreateCalendarEvent(
  userId: string,
  params: CreateCalendarEventParams
): Promise<ToolResult> {
  try {
    console.log('[CALENDAR] executeCreateCalendarEvent called');
    console.log('[CALENDAR] userId:', userId);
    console.log('[CALENDAR] Raw params received:', JSON.stringify(params, null, 2));
    
    // Fix: Unwrap parameters if incorrectly wrapped in "properties"
    // Some models incorrectly add this wrapper
    const actualParams = (params as any).properties || params;
    console.log('[CALENDAR] Unwrapped params:', JSON.stringify(actualParams, null, 2));
    
    // Validate parameters
    console.log('[CALENDAR] Validating parameters...');
    console.log('[CALENDAR] summary:', actualParams.summary);
    console.log('[CALENDAR] startTime:', actualParams.startTime);
    console.log('[CALENDAR] endTime:', actualParams.endTime);
    
    if (!actualParams.summary || !actualParams.startTime || !actualParams.endTime) {
      console.error('[CALENDAR] Validation failed - missing required parameters');
      return {
        success: false,
        error: 'Missing required parameters: summary, startTime, and endTime are required',
      };
    }

    console.log('[CALENDAR] Validation passed, calling n8n...');
    
    // Build parameters - only include fields that have actual values
    const normalizedParams: any = {
      summary: actualParams.summary,
      startTime: actualParams.startTime,
      endTime: actualParams.endTime,
    };
    
    // Only add optional fields if they have meaningful values
    if (actualParams.description && actualParams.description.trim()) {
      normalizedParams.description = actualParams.description;
    }
    
    if (actualParams.location && actualParams.location.trim()) {
      normalizedParams.location = actualParams.location;
    }
    
    console.log('[CALENDAR] Normalized params:', JSON.stringify(normalizedParams, null, 2));
    
    // Call n8n to create the event
    const result = await n8nCreateEvent(userId, normalizedParams);
    
    console.log('[CALENDAR] n8n response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.error('[CALENDAR] n8n returned failure:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to create calendar event',
      };
    }

    console.log('[CALENDAR] Event created successfully');
    return {
      success: true,
      data: result.data,
      metadata: {
        eventCreated: true,
        summary: actualParams.summary,
        startTime: actualParams.startTime,
      },
    };
  } catch (error) {
    console.error('[CALENDAR] Exception caught:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating calendar event',
    };
  }
}

/**
 * Tool definition for getting calendar events
 */
export const getCalendarEventsTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_calendar_events',
    description: 'Retrieve upcoming events from Google Calendar. By default, fetches events from now through the next 7 days. Use this to check availability or see what meetings are scheduled.',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Optional start date in ISO 8601 format (defaults to current time)',
        },
        endDate: {
          type: 'string',
          description: 'Optional end date in ISO 8601 format (defaults to 7 days from current time)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of events to return (default: 10)',
        },
      },
      required: [],
    },
  },
};

/**
 * Execute get calendar events
 */
export async function executeGetCalendarEvents(
  userId: string,
  params: {
    startDate?: string;
    endDate?: string;
    maxResults?: number;
  }
): Promise<ToolResult> {
  try {
    // Set default dates if not provided
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const defaultParams = {
      startDate: params.startDate || now.toISOString(),
      endDate: params.endDate || sevenDaysFromNow.toISOString(),
      maxResults: params.maxResults || 10,
    };

    const result = await getCalendarEvents(userId, defaultParams);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch calendar events',
      };
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        eventCount: Array.isArray(result.data) ? result.data.length : 0,
        startDate: defaultParams.startDate,
        endDate: defaultParams.endDate,
      },
    };
  } catch (error) {
    console.error('Get calendar events error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching calendar events',
    };
  }
}
