# MeetMind Extension - Quick Start Guide

## 🚀 1-Minute Setup

### Load Extension in Chrome
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select folder: `C:\Cllg_code_and_files\MeetMind\extension\dist`
5. Done! Purple brain icon appears in toolbar

### Start Backend
```bash
cd C:\Cllg_code_and_files\MeetMind\backend
npm run dev
```
✅ Backend runs on `http://localhost:3000`

### First Use
1. Click MeetMind icon in Chrome
2. Enter email: `test@meetmind.dev`
3. Enter name: `Test User`
4. Click "Get Started"

---

## 🧪 Test Commands

### Example 1: Calendar Query (n8n required)
```
Get my calendar events for today
```
**Expected**: Calls n8n workflow → Google Calendar API → returns events

### Example 2: Memory Storage (works without n8n)
```
Remember that John prefers morning meetings
```
**Expected**: Stores memory in PostgreSQL database

### Example 3: Context-Aware
1. Select text on any webpage
2. Open extension
3. Type: `Summarize this`
**Expected**: Agent receives selected text in context

---

## ✅ Verification

### Backend Online?
- Extension shows "● Online" (green) in top-right

### Database Logging?
```powershell
docker exec -it meetmind-postgres psql -U meetmind -d meetmind -c "SELECT * FROM interactions ORDER BY created_at DESC LIMIT 1;"
```
Should show your latest query

### n8n Workflows Active?
- Go to: `http://localhost:5678`
- Check workflows are activated (toggle switch)

---

## 📁 File Locations

| Component | Path |
|-----------|------|
| Extension (built) | `extension/dist/` |
| Extension (source) | `extension/src/` |
| Backend | `backend/src/` |
| Database | PostgreSQL in Docker |
| n8n | `http://localhost:5678` |
| Documentation | `PHASE1E_EXTENSION.md` |

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension shows "Offline" | Start backend: `cd backend && npm run dev` |
| Can't load extension | Select `extension/dist/`, not `extension/` |
| Changes not showing | Rebuild (`npm run build`) + Reload extension |
| "Module not found" error | Build shared: `cd shared && npm run build` |

---

## 🎯 Next Steps

1. ✅ Load extension
2. ✅ Start backend
3. ✅ Test simple query
4. ✅ Check database logs
5. 🔄 Create remaining n8n workflows (drive search, calendar get events)
6. 🔄 Test full workflow with Google APIs

---

See [PHASE1E_EXTENSION.md](PHASE1E_EXTENSION.md) for complete documentation.
