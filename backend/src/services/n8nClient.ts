/**
 * n8n Client Service
 * 
 * Handles all communication with n8n workflows.
 * This is the tool execution layer - backend never talks directly to Google APIs.
 * 
 * Architecture principle:
 * Backend calls n8n webhooks → n8n handles OAuth and API calls
 * 
 * Responsibilities:
 * - Send webhook requests to n8n
 * - Handle responses and errors
 * - Provide retry logic
 * - Type-safe interfaces for each workflow
 */

import axios, { AxiosError } from 'axios';
import type { N8nWebhookRequest, N8nWebhookResponse } from '@meetmind/shared';

/**
 * Base n8n configuration
 */
const N8N_CONFIG = {
  host: process.env.N8N_HOST || 'http://localhost:5678',
  webhookUrl: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook',
  apiKey: process.env.N8N_API_KEY,
  timeout: 30000, // 30 seconds
};

/**
 * n8n webhook endpoints for each action type
 */
const WEBHOOK_PATHS = {
  createCalendarEvent: '/calendar/create-event',
  sendEmail: '/email/send',
  fetchDriveFile: '/drive/fetch-file',
  searchDrive: '/drive/search',
  getCalendarEvents: '/calendar/get-events',
};

/**
 * Send request to n8n webhook
 */
async function sendN8nRequest(
  webhookPath: string,
  payload: N8nWebhookRequest
): Promise<N8nWebhookResponse> {
  const url = `${N8N_CONFIG.webhookUrl}${webhookPath}`;

  console.log('[N8N] Sending request:', {
    url,
    payload,
    n8nHost: N8N_CONFIG.host,
    hasApiKey: !!N8N_CONFIG.apiKey,
  });

  try {
    const response = await axios.post<N8nWebhookResponse>(url, payload, {
      timeout: N8N_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_CONFIG.apiKey ? { 'X-N8N-API-KEY': N8N_CONFIG.apiKey } : {}),
      },
    });

    console.log('[N8N] Request successful:', {
      status: response.status,
      data: response.data,
    });

    // Handle empty or string responses as success (n8n workflow may not return JSON)
    if (response.status === 200) {
      // If response.data is a string or empty, treat as success
      if (typeof response.data === 'string' || !response.data) {
        return {
          success: true,
          data: response.data || 'Operation completed successfully',
        };
      }
      
      // If response.data is an object, use it
      return response.data;
    }

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;

    console.error('[N8N] Request failed:', {
      webhookPath,
      url,
      error: axiosError.message,
      code: axiosError.code,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      responseData: axiosError.response?.data,
    });

    // Return error response
    return {
      success: false,
      error: axiosError.message || 'Unknown n8n error',
    };
  }
}

/**
 * Create a calendar event via n8n
 */
export async function createCalendarEvent(
  userId: string,
  params: {
    summary: string;
    description?: string;
    startTime: string;
    endTime: string;
    attendees?: string[];
    location?: string;
  }
): Promise<N8nWebhookResponse> {
  console.log('[N8N] Creating calendar event:', {
    endpoint: WEBHOOK_PATHS.createCalendarEvent,
    fullUrl: `${N8N_CONFIG.webhookUrl}${WEBHOOK_PATHS.createCalendarEvent}`,
    userId,
    params,
  });
  
  const response = await sendN8nRequest(WEBHOOK_PATHS.createCalendarEvent, {
    action: 'create_event',
    userId,
    parameters: params,
  });
  
  console.log('[N8N] Create calendar event response:', {
    success: response.success,
    error: response.error,
    data: response.data,
  });
  
  return response;
}

/**
 * Send email via n8n
 */
export async function sendEmail(
  userId: string,
  params: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    bodyType?: 'text' | 'html';
  }
): Promise<N8nWebhookResponse> {
  return sendN8nRequest(WEBHOOK_PATHS.sendEmail, {
    action: 'send_email',
    userId,
    parameters: params,
  });
}

/**
 * Fetch file from Google Drive via n8n
 */
export async function fetchDriveFile(
  userId: string,
  params: {
    fileId?: string;
    fileName?: string;
    mimeType?: string;
  }
): Promise<N8nWebhookResponse> {
  return sendN8nRequest(WEBHOOK_PATHS.fetchDriveFile, {
    action: 'fetch_file',
    userId,
    parameters: params,
  });
}

/**
 * Search Google Drive via n8n
 */
export async function searchDrive(
  userId: string,
  params: {
    query: string;
    mimeType?: string;
    limit?: number;
  }
): Promise<N8nWebhookResponse> {
  console.log('[N8N] Search Drive request:', {
    endpoint: WEBHOOK_PATHS.searchDrive,
    userId,
    params,
  });
  
  const response = await sendN8nRequest(WEBHOOK_PATHS.searchDrive, {
    action: 'search',
    userId,
    parameters: params,
  });
  
  console.log('[N8N] Search Drive response received:', {
    success: response.success,
    dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
    dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
  });
  
  return response;
}

/**
 * Get calendar events via n8n
 */
export async function getCalendarEvents(
  userId: string,
  params: {
    startDate?: string;
    endDate?: string;
    maxResults?: number;
  }
): Promise<N8nWebhookResponse> {
  console.log('[N8N] Getting calendar events with params:', JSON.stringify(params, null, 2));
  
  return sendN8nRequest(WEBHOOK_PATHS.getCalendarEvents, {
    action: 'get_events',
    userId,
    parameters: params,
  });
}

/**
 * Health check for n8n service
 */
export async function checkN8nHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${N8N_CONFIG.host}/healthz`, {
      timeout: 5000,
    });

    return response.status === 200;
  } catch (error) {
    console.error('n8n health check failed:', error);
    return false;
  }
}
