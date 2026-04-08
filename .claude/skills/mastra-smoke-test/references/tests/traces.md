# Traces Testing (`--test traces`)

## Purpose
Verify observability traces are being collected and displayed.

## Prerequisites
- Must have run agent/tool/workflow tests first (to generate traces)
- For cloud: Both Studio and Server should be deployed

## Steps

### 1. Navigate to Observability
- [ ] Open `/observability` in Studio
- [ ] Verify page loads without errors
- [ ] Check for existing traces

### 2. Verify Studio-Originated Traces
- [ ] Look for traces from previous tests (agent chat, tool runs)
- [ ] Traces should show: name, timestamp, duration, status
- [ ] Click on a trace to expand details

### 3. Check Trace Details
- [ ] Verify trace shows input/output
- [ ] Check for timing information
- [ ] Confirm no error states (unless expected)

### 4. Generate Server Trace (Cloud Only)
For `--env staging` or `--env production`:

```bash
curl -X POST <server-url>/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Weather in Paris?"}]}'
```

- [ ] Execute the curl command
- [ ] Note the response

### 5. Verify Server Trace Appears
- [ ] Refresh `/observability` page
- [ ] Look for new trace from Server API call
- [ ] Should appear within 30 seconds

## Expected Results

| Check | Expected |
|-------|----------|
| Traces page | Loads without errors |
| Studio traces | Visible from previous actions |
| Trace details | Shows input, output, duration |
| Server traces | Appear after API call (cloud) |

## Trace Sources

| Source | How Generated | Identifier |
|--------|---------------|------------|
| Studio | UI interactions (chat, tool runs) | From Studio domain |
| Server | Direct API calls | From server domain |

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No traces at all | OTel not configured | Check `telemetry` in mastra config |
| Studio traces only | Server token issue | Redeploy server |
| "Something went wrong" | Auth/session issue | Re-authenticate in Studio |
| `CLOUD_EXPORTER` warnings | Missing token | Infrastructure issue - note it |

## Local vs Cloud

**Local (`--env local`)**:
- Traces stored in-memory
- Only persist while dev server runs
- Check `@mastra/observability` is installed

**Cloud (`--env staging/production`)**:
- Traces sent to cloud collector
- Persist across sessions
- Both Studio and Server traces should appear

## Browser Actions

```
Navigate to: /observability
Wait: For traces to load
Verify: At least one trace visible
Click: On a trace row
Verify: Details panel shows input/output

# For cloud only:
Execute: curl command to server
Navigate to: /observability
Click: Refresh or wait
Verify: New server trace appears
```
