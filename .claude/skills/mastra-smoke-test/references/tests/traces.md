# Traces Testing (`--test traces`)

## Purpose

Verify observability traces are being collected and displayed.

## Prerequisites

- Must have run agent/tool/workflow tests first (to generate traces)
- For cloud: Both Studio and Server need to be deployed

## Steps

### 1. Navigate to Observability

- [ ] Open `/observability` in Studio
- [ ] Note if page loads and any errors displayed
- [ ] Record existing traces shown

### 2. Observe Studio-Originated Traces

- [ ] Look for traces from previous tests (agent chat, tool runs)
- [ ] Record what information traces show (name, timestamp, duration, status)
- [ ] Click on a trace to expand details

### 3. Check Trace Details

- [ ] Record what input/output is shown
- [ ] Note timing information displayed
- [ ] Record any error states shown

### 4. Generate Server Trace (Cloud Only)

For `--env staging` or `--env production`:

```bash
curl -X POST <server-url>/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Weather in Paris?"}]}'
```

- [ ] Execute the curl command
- [ ] Record the response

### 5. Check for Server Trace

- [ ] Refresh `/observability` page
- [ ] Note if new trace from Server API call appears
- [ ] Record how long until trace appears (if at all)

## Observations to Report

| Check         | What to Record                               |
| ------------- | -------------------------------------------- |
| Traces page   | Load behavior, any errors                    |
| Studio traces | Which traces appear from previous actions    |
| Trace details | Input, output, duration shown                |
| Server traces | Whether traces appear after API call, timing |

## Trace Sources

| Source | How Generated                     | Identifier         |
| ------ | --------------------------------- | ------------------ |
| Studio | UI interactions (chat, tool runs) | From Studio domain |
| Server | Direct API calls                  | From server domain |

## Troubleshooting

| Symptom                   | Likely Cause        | Fix                                |
| ------------------------- | ------------------- | ---------------------------------- |
| No traces at all          | OTel not configured | Check `telemetry` in mastra config |
| Studio traces only        | Server token issue  | Redeploy server                    |
| "Something went wrong"    | Auth/session issue  | Re-authenticate in Studio          |
| `CLOUD_EXPORTER` warnings | Missing token       | Infrastructure issue - note it     |

## Local vs Cloud

**Local (`--env local`)**:

- Traces stored in-memory
- Only persist while dev server runs
- Check `@mastra/observability` is installed

**Cloud (`--env staging/production`)**:

- Traces sent to cloud collector
- Persist across sessions
- Note if both Studio and Server traces appear

## Browser Actions

```text
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
