# MeetMind Setup Guide

Complete setup instructions for running MeetMind Phase 1 locally.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 18+** and npm 9+
- ✅ **Docker** and **Docker Compose**
- ✅ **Chrome browser**
- ✅ **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))
- ✅ **Google Cloud account** (for OAuth setup)

## Step 1: Clone and Install

```bash
# Navigate to project directory
cd MeetMind

# Install all dependencies (uses npm workspaces)
npm install

# Build shared types
cd shared
npm run build
cd ..
```

## Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
# Update these values:
# - OPENAI_API_KEY=your-actual-openai-key
# - Other values can stay as defaults for local development
```

Required environment variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `DATABASE_URL`: PostgreSQL connection (default works for Docker)
- `N8N_HOST`: n8n URL (default: http://localhost:5678)

## Step 3: Start Infrastructure

```bash
# Start PostgreSQL and n8n with Docker Compose
npm run docker:up

# Wait about 30 seconds for services to be ready
# Check logs if needed:
npm run docker:logs
```

This starts:
- **PostgreSQL** on port 5432
- **n8n** on port 5678

## Step 4: Setup Google OAuth (Required for n8n)

### 4.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Note your project ID

### 4.2 Enable APIs

Enable these APIs in your project:
- Google Calendar API
- Gmail API
- Google Drive API

Quick link: [API Library](https://console.cloud.google.com/apis/library)

### 4.3 Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Configure consent screen if prompted:
   - User Type: External
   - App name: MeetMind Dev
   - User support email: your-email
   - Developer contact: your-email
   - Save
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: MeetMind n8n
   - Authorized redirect URIs: `http://localhost:5678/rest/oauth2-credential/callback`
   - Create
5. **Copy Client ID and Client Secret** - you'll need these!

### 4.4 Add Test Users (if using External consent screen)

1. Go to **OAuth consent screen**
2. Under **Test users**, click **Add Users**
3. Add your Google email address
4. Save

## Step 5: Configure n8n Workflows

### 5.1 Access n8n

Open browser to: http://localhost:5678

First-time setup:
- Email: admin@meetmind.dev
- Password: admin (or set your own)

### 5.2 Add Google Credentials to n8n

For **each** Google service (Calendar, Gmail, Drive):

1. Click **Credentials** in left sidebar
2. Click **Add Credential**
3. Search for service (e.g., "Google Calendar")
4. Choose **OAuth2 API**
5. Enter:
   - **Client ID**: from Google Cloud Console
   - **Client Secret**: from Google Cloud Console
6. Click **Connect my account**
7. Sign in with your Google account
8. Grant permissions
9. Save

Repeat for:
- Google Calendar OAuth2 API
- Gmail OAuth2 API
- Google Drive OAuth2 API

### 5.3 Create n8n Workflows

Follow the detailed guide: [infrastructure/n8n-setup.md](infrastructure/n8n-setup.md)

You need to create 5 workflows:
1. Create Calendar Event
2. Send Email
3. Fetch Drive File
4. Search Drive
5. Get Calendar Events

**Quick Test:**

After creating a workflow, test it:

```bash
curl -X POST http://localhost:5678/webhook/calendar/get-events \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_events",
    "userId": "test",
    "parameters": {
      "maxResults": 5
    }
  }'
```

You should see your calendar events!

## Step 6: Start Backend

```bash
# In project root
npm run dev:backend
```

The backend will:
- Connect to PostgreSQL
- Initialize database schema
- Start on http://localhost:3000

Verify it's running:
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

## Step 7: Build Chrome Extension

```bash
# In a new terminal
npm run dev:extension

# This builds to extension/dist and watches for changes
```

## Step 8: Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Navigate to `MeetMind/extension/dist`
6. Select the folder

You should see **MeetMind** extension loaded!

## Step 9: Test End-to-End

### 9.1 Setup User in Extension

1. Click MeetMind extension icon
2. Enter your email and name
3. Click "Get Started"

### 9.2 Test a Simple Command

Try these commands:

**Get calendar events:**
```
Show me my calendar for today
```

**Create event:**
```
Schedule a test meeting tomorrow at 2pm for 1 hour
```

**Send email:**
```
Send an email to yourself@gmail.com saying "Test from MeetMind"
```

### 9.3 Check Logs

Backend logs will show:
- Agent iterations
- Tool calls
- Database operations

n8n execution logs show:
- Webhook calls
- Google API calls
- Responses

## Troubleshooting

### Backend won't start

```bash
# Check PostgreSQL is running
docker ps

# Check database connection
docker exec -it meetmind-postgres psql -U meetmind -d meetmind -c "SELECT 1"
```

### Extension can't connect to backend

- Verify backend is running on port 3000
- Check browser console for CORS errors
- Ensure `ALLOWED_ORIGINS` in .env includes extension ID

### n8n workflows not working

- Check credentials are authorized
- Verify webhook paths match backend expectations
- Check n8n execution logs (click clock icon in n8n)
- Test workflows individually with curl

### Google API errors

- Verify APIs are enabled in Google Cloud Console
- Check OAuth scopes are granted
- Ensure test user is added (if using External consent)
- Re-authorize credentials in n8n if expired

### Database errors

```bash
# Reset database
npm run docker:down
npm run docker:up
# Backend will recreate schema on next start
```

## Development Workflow

Typical development session:

```bash
# Terminal 1: Infrastructure
npm run docker:up

# Terminal 2: Backend
npm run dev:backend

# Terminal 3: Extension (if making UI changes)
npm run dev:extension

# When done:
# Ctrl+C in terminals 2-3
npm run docker:down  # Optional, can leave running
```

## Next Steps

Once everything works:

1. ✅ Test all tool types (calendar, email, drive, memory)
2. ✅ Review database to see logged interactions
3. ✅ Try complex multi-step queries
4. ✅ Explore n8n workflow customization
5. ✅ Read architecture docs for understanding

## Getting Help

- Check [README.md](README.md) for architecture overview
- Review component READMEs:
  - [backend/README.md](backend/README.md)
  - [extension/README.md](extension/README.md)
- Check n8n logs for integration issues
- Review OpenAI usage in your account

## Production Deployment

This setup is for **local development only**.

Phase 4 will add:
- Cloud deployment
- Production database
- HTTPS/SSL
- Authentication
- Rate limiting
- Monitoring

---

**You're ready to use MeetMind! 🚀**

Try asking it to:
- Schedule your meetings
- Send follow-up emails
- Summarize conversations
- Store decisions
- Search your workspace

The agent will figure out what tools to use and execute them for you.
