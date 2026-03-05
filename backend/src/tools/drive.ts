/**
 * Google Drive Tool
 * 
 * Handles Google Drive file operations.
 * Integrates with n8n for Google Drive API access.
 * 
 * Capabilities:
 * - Fetch files by ID or name
 * - Search Drive
 * - Get file metadata
 */

import type { ToolDefinition, ToolResult, FetchDriveFileParams } from '@meetmind/shared';
import { fetchDriveFile as n8nFetchFile, searchDrive as n8nSearchDrive } from '../services/n8nClient';

/**
 * Tool definition for fetching Drive files
 */
export const fetchDriveFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'fetch_drive_file',
    description: 'Fetch a file from Google Drive by ID or name. Use this when the user wants to access or retrieve a Drive file.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Google Drive file ID',
        },
        fileName: {
          type: 'string',
          description: 'Name of the file to search for (if fileId is not provided)',
        },
        mimeType: {
          type: 'string',
          description: 'Optional MIME type filter (e.g., "application/pdf", "application/vnd.google-apps.document")',
        },
      },
      required: [],
    },
  },
};

/**
 * Execute Drive file fetch
 */
export async function executeFetchDriveFile(
  userId: string,
  params: FetchDriveFileParams
): Promise<ToolResult> {
  try {
    // Validate that we have either fileId or fileName
    if (!params.fileId && !params.fileName) {
      return {
        success: false,
        error: 'Either fileId or fileName must be provided',
      };
    }

    const result = await n8nFetchFile(userId, params);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch Drive file',
      };
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        fileRetrieved: true,
        searchMethod: params.fileId ? 'fileId' : 'fileName',
      },
    };
  } catch (error) {
    console.error('Drive file fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching Drive file',
    };
  }
}

/**
 * Tool definition for searching Drive
 */
export const searchDriveTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_drive',
    description: 'Search for files in Google Drive. Use this to find files by name, content, or type.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (file name, content, etc.)',
        },
        mimeType: {
          type: 'string',
          description: 'Optional MIME type filter',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Execute Drive search
 */
export async function executeSearchDrive(
  userId: string,
  params: {
    query: string;
    mimeType?: string;
    limit?: number;
  }
): Promise<ToolResult> {
  try {
    console.log('[DRIVE] Executing search_drive with params:', JSON.stringify(params));
    
    if (!params.query) {
      return {
        success: false,
        error: 'Search query is required',
      };
    }

    console.log('[DRIVE] Calling n8n search for userId:', userId);
    const result = await n8nSearchDrive(userId, params);
    console.log('[DRIVE] n8n response:', JSON.stringify(result, null, 2));

    if (!result.success) {
      console.log('[DRIVE] n8n returned error:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to search Drive',
      };
    }

    // n8n might return a single object or an array
    // Normalize to always be an array
    let files = result.data;
    if (!Array.isArray(files)) {
      if (files && typeof files === 'object') {
        // Single file returned as object - wrap it in an array
        files = [files];
        console.log('[DRIVE] n8n returned single object, wrapping in array');
      } else {
        // No data
        files = [];
      }
    }

    const resultCount = files.length;
    console.log('[DRIVE] Found', resultCount, 'files');
    
    if (resultCount === 0) {
      console.log('[DRIVE] No files found for query:', params.query);
    }

    return {
      success: true,
      data: files,
      metadata: {
        searchPerformed: true,
        query: params.query,
        resultCount,
      },
    };
  } catch (error) {
    console.error('Drive search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error searching Drive',
    };
  }
}
