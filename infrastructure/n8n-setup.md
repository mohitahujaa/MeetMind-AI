# n8n Workflow Configuration Guide

This document explains how to set up n8n workflows for MeetMind.

## Overview

n8n handles all Google API integrations:
- OAuth authentication
- Google Calendar operations
- Gmail operations
- Google Drive operations

The backend never talks directly to Google APIs - it only calls n8n webhooks.

## Setup Steps

### 1. Access n8n

After starting Docker Compose, access n8n at: `http://localhost:5678`

Default credentials:
- Username: `admin`
- Password: `admin`

### 2. Configure Google OAuth Credentials

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable APIs:
   - Google Calendar API
   - Gmail API
   - Google Drive API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:5678/rest/oauth2-credential/callback`
5. Copy Client ID and Client Secret

### 3. Add Credentials in n8n

1. In n8n, go to **Credentials** → **New**
2. Search for "Google"
3. Add credentials for:
   - **Google Calendar API**
   - **Gmail API**
   - **Google Drive API**
4. Use the OAuth credentials from step 2
5. Authorize each credential

## Required Workflows

### Workflow 1: Create Calendar Event

**Webhook Path:** `/webhook/calendar/create-event`

**Nodes:**
1. **Webhook** (Trigger)
   - Method: POST
   - Path: `/calendar/create-event`
   - Response Mode: Last Node

2. **Google Calendar** (Action)
   - Operation: Create Event
   - Calendar: Primary
   - Event:
     - Summary: `{{ $json.parameters.summary }}`
     - Description: `{{ $json.parameters.description }}`
     - Start: `{{ $json.parameters.startTime }}`
     - End: `{{ $json.parameters.endTime }}`
     - Attendees: `{{ $json.parameters.attendees }}`
     - Location: `{{ $json.parameters.location }}`

3. **Respond to Webhook**
   - Response: `{{ { "success": true, "data": $json } }}`

**Error Handling:**
- Add Error Trigger node
- Return: `{{ { "success": false, "error": $json.message } }}`

---

### Workflow 2: Send Email

**Webhook Path:** `/webhook/email/send`

**Nodes:**
1. **Webhook** (Trigger)
   - Method: POST
   - Path: `/email/send`

2. **Gmail** (Action)
   - Operation: Send Email
   - To: `{{ $json.parameters.to.join(',') }}`
   - Cc: `{{ $json.parameters.cc?.join(',') || '' }}`
   - Subject: `{{ $json.parameters.subject }}`
   - Message: `{{ $json.parameters.body }}`
   - Message Type: `{{ $json.parameters.bodyType || 'text' }}`

3. **Respond to Webhook**
   - Response: `{{ { "success": true, "data": $json } }}`

---

### Workflow 3: Fetch Drive File

**Webhook Path:** `/webhook/drive/fetch-file`

**Nodes:**
1. **Webhook** (Trigger)
   - Method: POST
   - Path: `/drive/fetch-file`

2. **Google Drive** (Action)
   - Operation: Download File
   - File ID: `{{ $json.parameters.fileId }}`
   - (OR use Search if fileName provided)

3. **Respond to Webhook**
   - Response: `{{ { "success": true, "data": $json } }}`

---

### Workflow 4: Search Drive

**Webhook Path:** `/webhook/drive/search`

**Nodes:**
1. **Webhook** (Trigger)
   - Method: POST
   - Path: `/drive/search`

2. **Google Drive** (Action)
   - Operation: Search Files
   - Query: `{{ $json.parameters.query }}`
   - Limit: `{{ $json.parameters.limit || 10 }}`

3. **Respond to Webhook**
   - Response: `{{ { "success": true, "data": $json } }}`

---

### Workflow 5: Get Calendar Events

**Webhook Path:** `/webhook/calendar/get-events`

**Nodes:**
1. **Webhook** (Trigger)
   - Method: POST
   - Path: `/calendar/get-events`

2. **Google Calendar** (Action)
   - Operation: Get All Events
   - Calendar: Primary
   - Time Min: `{{ $json.parameters.startDate || new Date().toISOString() }}`
   - Time Max: `{{ $json.parameters.endDate }}`
   - Max Results: `{{ $json.parameters.maxResults || 10 }}`

3. **Respond to Webhook**
   - Response: `{{ { "success": true, "data": $json } }}`

---

## Testing Workflows

After creating each workflow:

1. **Activate** the workflow
2. Copy the webhook URL
3. Test with curl:

```bash
curl -X POST http://localhost:5678/webhook/calendar/create-event \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_event",
    "userId": "test-user",
    "parameters": {
      "summary": "Test Meeting",
      "startTime": "2024-03-20T10:00:00Z",
      "endTime": "2024-03-20T11:00:00Z"
    }
  }'
```

## Important Notes

1. **Webhook URLs**: The backend expects webhooks at specific paths. Make sure paths match the configuration in `backend/src/services/n8nClient.ts`

2. **Error Handling**: Every workflow should have error handling that returns:
   ```json
   {
     "success": false,
     "error": "Error message"
   }
   ```

3. **OAuth Tokens**: n8n handles token refresh automatically. No additional work needed.

4. **Security**: In production:
   - Use API key authentication for webhooks
   - Set `N8N_API_KEY` environment variable
   - Use HTTPS
   - Restrict IP access

## Workflow Export/Import

n8n allows exporting workflows as JSON. Once you create these workflows:

1. Click the workflow menu (three dots)
2. Select "Download"
3. Save workflow JSON files
4. Share with team or store in version control

To import:
1. Click "Import from File"
2. Select workflow JSON
3. Update credentials
4. Activate

## Next Steps

1. Create all 5 workflows
2. Test each webhook endpoint
3. Update `.env` file with webhook URLs if different
4. Monitor n8n logs for errors

## Support

n8n documentation: https://docs.n8n.io
Google API docs: https://developers.google.com
