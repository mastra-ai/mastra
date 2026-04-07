# Server Deploy Testing (`--test server`)

**Cloud only**: For `--env staging` or `--env production`.

## Purpose
Verify Server deployment works and API is accessible.

## Prerequisites
- Mastra platform account
- Project with at least one agent
- Authenticated via `mastra auth login`
- Studio should be deployed first (recommended)

## Steps

### 1. Set Environment
```bash
# For staging
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai

# For production (default)
unset MASTRA_PLATFORM_API_URL
```

### 2. Authenticate (if not already)
```bash
pnpx mastra@latest auth login
```

### 3. Deploy Server
```bash
pnpx mastra@latest server deploy -y
```

**Watch for:**
- [ ] Build starts
- [ ] Build completes (note any warnings)
- [ ] Deploy starts
- [ ] **Capture Server URL from output**

**Critical warnings to note:**
- `mastra-cloud-observability-exporter disabled` - traces won't work
- `CLOUD_EXPORTER_FAILED_TO_BATCH_UPLOAD_LOGS` - trace endpoint issue

### 4. Verify Health Endpoint
```bash
curl <server-url>/health
# Expected: {"success":true}
```
- [ ] Returns 200 OK
- [ ] Response includes success indicator

### 5. Test Agent API
```bash
curl -X POST <server-url>/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Weather in Tokyo?"}]}'
```
- [ ] Returns 200 OK
- [ ] Response includes agent output

### 6. Use Test Script
```bash
.claude/skills/mastra-smoke-test/scripts/test-server.sh <server-url>
```
- [ ] Health check passes
- [ ] Agent call succeeds
- [ ] Script exits with 0

### 7. Verify Traces in Studio
- [ ] Open Studio `/observability`
- [ ] Refresh page
- [ ] Look for trace from Server API call
- [ ] Should appear within 30 seconds

## Expected Results

| Check | Expected |
|-------|----------|
| Deploy | Completes without errors |
| URL | Valid Server URL returned |
| Health | `/health` returns success |
| Agent API | Returns valid response |
| Traces | Appear in Studio |

## Deploy URLs

| Environment | URL Pattern |
|-------------|-------------|
| Staging | `https://<project>.server.staging.mastra.cloud` |
| Production | `https://<project>.server.mastra.cloud` |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/agents/<id>/generate` | POST | Agent generation |
| `/api/agents/<id>/stream` | POST | Streaming generation |
| `/<custom-route>` | ANY | Custom API routes |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 403 on health | Not deployed yet | Wait or redeploy |
| Agent 404 | Wrong agent ID | Check agent IDs in project |
| Traces missing | Token issue | Check deploy warnings, redeploy |
| Timeout | Cold start | Retry after 30 seconds |

## Notes

- Server cold starts may take 10-30 seconds
- First request after deploy may be slow
- Traces may take up to 30 seconds to appear
- Redeploy if traces consistently missing
