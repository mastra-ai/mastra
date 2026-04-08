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

**⚠️ REQUIRED: Expand a Log Entry**
You MUST click on a log row to expand it. Do not just observe the table.

1. Find a recent request in the table
2. **Click on the row** to expand it
3. In the expanded view, verify:
   - [ ] prompt_tokens value displayed (record the number)
   - [ ] completion_tokens value displayed (record the number)
   - [ ] total_tokens displayed (record the number)
   - [ ] cache_write_tokens or cache_read_tokens if present (record values)

**Multi-Provider Verification (if multiple providers used):**

1. Find a log entry for each provider you've tested
2. **Click to expand each one**
3. [ ] Token breakdown appears for each provider
4. [ ] Record any differences in how tokens are displayed

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

**⚠️ REQUIRED: Systematically test navigation**

1. **Sidebar test:**
   - [ ] Click each sidebar item in sequence
   - [ ] Record if all sections load

2. **Back button test:**
   - [ ] Navigate: Projects → Threads → Logs
   - [ ] Click browser back button twice
   - [ ] Record if you return to Projects correctly

3. **Page refresh test:**
   - [ ] Navigate to Logs page
   - [ ] Refresh the browser (F5 or Cmd+R)
   - [ ] Record if you stay on Logs page with state preserved

## Observations to Report

| Page     | What to Record                           |
| -------- | ---------------------------------------- |
| Projects | Note what appears on the page            |
| Threads  | Record if list loads, note details shown |
| Logs     | Record table contents and expandability  |
| Usage    | Note if charts render, record data shown |
| Settings | Record available options                 |

## Common Issues

| Issue               | Cause      | Fix                      |
| ------------------- | ---------- | ------------------------ |
| Empty pages         | No data    | Make some requests first |
| Charts not loading  | JS error   | Check browser console    |
| Settings won't save | Auth issue | Re-login                 |

## Browser Actions

```text
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
