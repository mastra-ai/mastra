# Server Deploy Testing (`--test server`)

**Cloud only**: For `--env staging` or `--env production`.

## Purpose

Verify Server deployment works and API is accessible.

## Prerequisites

- Mastra platform account
- Project with at least one agent
- Authenticated via `mastra auth login`
- Studio deployed first (recommended)

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

### 4. Test Health Endpoint

```bash
curl <server-url>/health
```

- [ ] Record HTTP status code returned
- [ ] Record response body content

### 5. Test Agent API

```bash
curl -X POST <server-url>/api/agents/weather-agent/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Weather in Tokyo?"}]}'
```

- [ ] Record HTTP status code returned
- [ ] Record response content

### 6. Use Test Script

```bash
.claude/skills/mastra-smoke-test/scripts/test-server.sh <server-url>
```

- [ ] Record health check result
- [ ] Record agent call result
- [ ] Note script exit code

### 7. Check Traces in Studio

- [ ] Open Studio `/observability`
- [ ] Refresh page
- [ ] Note if trace from Server API call appears
- [ ] Record how long until trace appears (if at all)

## Observations to Report

| Check     | What to Record                            |
| --------- | ----------------------------------------- |
| Deploy    | Completion status, any errors or warnings |
| URL       | Server URL returned                       |
| Health    | HTTP status and response from `/health`   |
| Agent API | HTTP status and response content          |
| Traces    | Whether traces appear, timing             |

## Deploy URLs

| Environment | URL Pattern                                     |
| ----------- | ----------------------------------------------- |
| Staging     | `https://<project>.server.staging.mastra.cloud` |
| Production  | `https://<project>.server.mastra.cloud`         |

## API Endpoints

| Endpoint                    | Method | Purpose              |
| --------------------------- | ------ | -------------------- |
| `/health`                   | GET    | Health check         |
| `/api/agents/<id>/generate` | POST   | Agent generation     |
| `/api/agents/<id>/stream`   | POST   | Streaming generation |
| `/<custom-route>`           | ANY    | Custom API routes    |

## Common Issues

| Issue          | Cause            | Fix                             |
| -------------- | ---------------- | ------------------------------- |
| 403 on health  | Not deployed yet | Wait or redeploy                |
| Agent 404      | Wrong agent ID   | Check agent IDs in project      |
| Traces missing | Token issue      | Check deploy warnings, redeploy |
| Timeout        | Cold start       | Retry after 30 seconds          |

## Notes

- Server cold starts may take 10-30 seconds
- First request after deploy may be slow
- Traces may take up to 30 seconds to appear
- Redeploy if traces consistently missing
