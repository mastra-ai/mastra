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

## Curl / API (for `--skip-browser`, local)

The same `/api/observability/traces` endpoint works locally (no auth needed):

```bash
# List recent spans (response shape: { pagination, spans })
curl -s "http://localhost:4111/api/observability/traces?page=0&perPage=20" | jq '.'

# Get a specific trace by id (captured from a prior agent/workflow response)
curl -s "http://localhost:4111/api/observability/traces/<traceId>" | jq '.'
```

**Response shape:** `GET /api/observability/traces` returns
`{ pagination: { total, page, perPage, hasMore }, spans: [...] }` — **not**
a bare array and **not** a `traces` key. Each entry in `spans` has
`spanType` (`agent_run`, `tool_call`, `workflow_run`, `scorer_run`),
`traceId`, timestamps, and payload.

Quick pass check:

```bash
curl -s "http://localhost:4111/api/observability/traces?page=0&perPage=100" | \
  jq '{total: .pagination.total, byType: ([.spans[].spanType] | group_by(.) | map({t: .[0], n: length}))}'
```

**Pass criteria (local):**

- After running agent / tool / workflow tests, `.pagination.total > 0`
- `.spans` contains the expected `spanType`s: `agent_run`, `workflow_run`,
  `scorer_run` (and `tool_call` if the agent invoked a tool)
- `traceId` values returned in earlier generate/workflow responses resolve
  via `/observability/traces/:traceId`

**Note:** local traces are in-memory only (DefaultExporter). They disappear
on dev server restart. Run the agent/tool/workflow tests in the same dev
server session as the traces test.

## Direct Trace API (Cloud Only)

If UI traces aren't appearing but you need to verify the trace pipeline:

### Mobs-Query URLs

| Environment | URL                                          |
| ----------- | -------------------------------------------- |
| Production  | `https://mobs-query-vgvrl5lbxq-uc.a.run.app` |
| Staging     | `https://mobs-query-pvyw2kfhjq-uc.a.run.app` |

### Get Auth Token

Credentials are stored in `~/.mastra/credentials.json` after `mastra auth login`:

```json
{
  "token": "eyJhbG...", // Access token (5 min expiry)
  "refreshToken": "eyJhbG...", // Refresh token (long-lived)
  "user": { "id": "...", "email": "..." },
  "organizationId": "org_01KN...",
  "currentOrgId": "org_01KN..."
}
```

### Token Refresh Helper

WorkOS tokens expire in **5 minutes**. Use this helper to auto-refresh:

```bash
get_valid_token() {
  local PLATFORM_URL="${1:-https://platform.mastra.ai}"
  local TOKEN=$(jq -r '.token' ~/.mastra/credentials.json)
  local ORG_ID=$(jq -r '.currentOrgId // .organizationId' ~/.mastra/credentials.json)

  # Try current token
  local VERIFY=$(curl -s "$PLATFORM_URL/v1/auth/verify" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-organization-id: $ORG_ID")

  if echo "$VERIFY" | jq -e '.user' > /dev/null 2>&1; then
    echo "$TOKEN"
    return 0
  fi

  # Token expired — try refresh
  local REFRESH_TOKEN=$(jq -r '.refreshToken' ~/.mastra/credentials.json)
  if [ -z "$REFRESH_TOKEN" ] || [ "$REFRESH_TOKEN" = "null" ]; then
    echo "No refresh token. Re-login required." >&2
    return 1
  fi

  local REFRESH_RESULT=$(curl -s "$PLATFORM_URL/v1/auth/refresh-token" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")

  if echo "$REFRESH_RESULT" | jq -e '.accessToken' > /dev/null 2>&1; then
    local NEW_TOKEN=$(echo "$REFRESH_RESULT" | jq -r '.accessToken')
    local NEW_REFRESH=$(echo "$REFRESH_RESULT" | jq -r '.refreshToken')

    # Update credentials file
    jq --arg t "$NEW_TOKEN" --arg r "$NEW_REFRESH" \
      '.token = $t | .refreshToken = $r' \
      ~/.mastra/credentials.json > ~/.mastra/credentials.json.tmp \
      && mv ~/.mastra/credentials.json.tmp ~/.mastra/credentials.json

    echo "$NEW_TOKEN"
    return 0
  fi

  echo "Refresh failed. Re-login required." >&2
  return 1
}

# Usage
TOKEN=$(get_valid_token "https://platform.mastra.ai") || exit 1
```

### Query Traces

```bash
# Get project info from config file
PROJECT_ID=$(jq -r '.projectId' .mastra-project.json)  # or .mastra-project-staging.json
ORG_ID=$(jq -r '.organizationId' .mastra-project.json)
TOKEN=$(get_valid_token "https://platform.mastra.ai")

# Production
curl -s "https://mobs-query-vgvrl5lbxq-uc.a.run.app/api/observability/traces?page=0&perPage=10&resourceId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq '.'

# Staging
TOKEN=$(get_valid_token "https://platform.staging.mastra.ai")
curl -s "https://mobs-query-pvyw2kfhjq-uc.a.run.app/api/observability/traces?page=0&perPage=10&resourceId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-organization-id: $ORG_ID" | jq '.'
```

### Trace Response Structure

```json
{
  "pagination": { "total": 10, "page": 0, "perPage": 10, "hasMore": false },
  "traces": [
    {
      "traceId": "37f0d68d760887e994135c984ebd7b89",
      "name": "agent run: 'weather-agent'",
      "spanType": "agent_run",
      "startedAt": "2026-04-08T15:29:27.123Z",
      "endedAt": "2026-04-08T15:29:30.456Z",
      "metadata": { "buildId": "...", "runId": "..." },
      "requestContext": { "user": { "id": "...", "email": "..." } },
      "status": "success"
    }
  ]
}
```

| Field              | Description                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `metadata.buildId` | Deploy ID (studio or server)                                      |
| `requestContext`   | Present for studio traces (authenticated), null for server traces |
| `spanType`         | `agent_run`, `tool_call`, `workflow_run`, etc.                    |
| `status`           | `success`, `error`, `running`                                     |

### Filter Traces

```bash
# By time range (URL-encoded JSON)
curl -s "...?startedAt=%7B%22start%22%3A%222026-04-08T15%3A00%3A00.000Z%22%7D" ...

# By resource ID (project)
curl -s "...?resourceId=$PROJECT_ID" ...

# By run ID
curl -s "...?runId=$RUN_ID" ...
```

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
