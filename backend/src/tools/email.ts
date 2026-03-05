/**
 * Email Tool
 * 
 * Handles email-related operations.
 * Integrates with n8n for Gmail API access.
 * 
 * Capabilities:
 * - Send emails
 * - Draft emails (future)
 * - Search emails (future)
 */

import type { ToolDefinition, ToolResult, SendEmailParams } from '@meetmind/shared';
import { sendEmail as n8nSendEmail } from '../services/n8nClient';

/**
 * Tool definition for sending emails
 */
export const sendEmailTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'send_email',
    description: 'Send an email via Gmail. Use this when the user wants to send a message, follow up, or communicate via email.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          description: 'Array of recipient email addresses',
        },
        cc: {
          type: 'array',
          description: 'Optional array of CC email addresses',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content',
        },
        bodyType: {
          type: 'string',
          description: 'Body format: "text" or "html" (default: text)',
          enum: ['text', 'html'],
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
};

/**
 * Execute email sending
 */
export async function executeSendEmail(
  userId: string,
  params: SendEmailParams
): Promise<ToolResult> {
  try {
    // Validate parameters
    if (!params.to || params.to.length === 0) {
      return {
        success: false,
        error: 'At least one recipient email address is required',
      };
    }

    if (!params.subject) {
      return {
        success: false,
        error: 'Email subject is required',
      };
    }

    if (!params.body) {
      return {
        success: false,
        error: 'Email body is required',
      };
    }

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = params.to.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      return {
        success: false,
        error: `Invalid email address(es): ${invalidEmails.join(', ')}`,
      };
    }

    // Call n8n to send the email  
    // n8n expects email addresses as comma-separated strings
    const normalizedParams: any = {
      to: Array.isArray(params.to) ? params.to.join(',') : params.to,
      subject: params.subject,
      body: params.body,
      bodyType: params.bodyType || 'text',
    };
    
    // Only add cc if it has recipients
    if (params.cc && Array.isArray(params.cc) && params.cc.length > 0) {
      normalizedParams.cc = params.cc.join(',');
    }
    
    const result = await n8nSendEmail(userId, normalizedParams);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to send email',
      };
    }

    return {
      success: true,
      data: result.data,
      metadata: {
        emailSent: true,
        recipients: params.to,
        subject: params.subject,
      },
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email',
    };
  }
}
