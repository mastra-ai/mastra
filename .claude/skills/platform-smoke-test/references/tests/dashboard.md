# Dashboard UI Testing (`--test dashboard`)

## Purpose
Verify all dashboard pages load and function correctly.

## Prerequisites
- Logged into dashboard
- Some API requests made (for data to display)

## Steps

### 1. Projects Page
Navigate to `$GATEWAY_URL`

- [ ] Projects list displayed
- [ ] Can click into project details
- [ ] Project status shown (if deployed)

### 2. Threads Page
Navigate to Dashboard → Threads

- [ ] Threads list displayed
- [ ] Can click into thread details
- [ ] Messages displayed correctly
- [ ] Timeline/flame graph working (if applicable)

### 3. Logs Page
Navigate to Dashboard → Logs

- [ ] Request logs displayed in table
- [ ] Can filter by date/status
- [ ] Log details expand when clicked

**Token Verification:**
1. Find a recent request
2. Expand the log entry
3. [ ] prompt_tokens displayed (not just cached_tokens)
4. [ ] completion_tokens displayed
5. [ ] total_tokens displayed
6. [ ] cache_write_tokens shown (should not always be 0)

**Multi-Provider Verification:**
1. Send requests with different providers
2. [ ] Logs show correct provider for each
3. [ ] Token display consistent between providers

### 4. Usage Page
Navigate to Dashboard → Usage

- [ ] Charts render correctly
- [ ] Cost tab shows breakdown
- [ ] Model breakdown accurate
- [ ] Date range selector works

### 5. Settings Page
Navigate to Dashboard → Settings

- [ ] Project settings accessible
- [ ] OM thresholds displayed
- [ ] API keys section works
- [ ] Provider keys configurable

### 6. Navigation Test
- [ ] Sidebar navigation works
- [ ] Can switch between sections
- [ ] Back button works correctly
- [ ] Page refresh maintains state

## Expected Results

| Page | Expected |
|------|----------|
| Projects | List of projects |
| Threads | List with details |
| Logs | Request table with expandable rows |
| Usage | Charts and costs |
| Settings | Configurable options |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Empty pages | No data | Make some requests first |
| Charts not loading | JS error | Check browser console |
| Settings won't save | Auth issue | Re-login |

## Browser Actions

```
Navigate to: $GATEWAY_URL
Verify: Projects list loads

Click: A project
Verify: Project details page

Navigate: Threads tab
Verify: Thread list loads
Click: A thread
Verify: Messages displayed

Navigate: Logs tab
Verify: Request table loads
Click: A log row
Verify: Details expand

Navigate: Usage tab
Verify: Charts render
Click: Date range selector
Verify: Data updates

Navigate: Settings
Verify: All sections accessible
```
