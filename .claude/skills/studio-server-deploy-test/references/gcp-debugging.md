# GCP Debugging Guide

## GCP Projects

| Environment | Description |
|-------------|-------------|
| Staging | Pre-production testing environment |
| Production | Live environment |

Ask a team member with GCP access for project details if needed.

## Accessing Cloud Run Logs

1. Go to [GCP Console](https://console.cloud.google.com)
2. Select the appropriate project (staging or production)
3. Navigate to **Cloud Run** in the left sidebar
4. Select the service you want to debug
5. Click **Logs** tab

## Key Services to Check

### mobs-collector

**What it does**: Receives trace spans from deployed servers/studios, validates JWT, publishes to Pub/Sub.

**Location**: Cloud Run → `mobs-collector`

**What to look for**:

| Log Pattern | Meaning |
|-------------|---------|
| `POST 200 /ai/spans/publish` | ✅ Traces received successfully |
| `POST 401 /ai/spans/publish` | ❌ JWT authentication failed |
| `POST 404 /` | ❌ Wrong endpoint (missing `/ai/spans/publish` path) |
| `Received N spans from org_xxx/project_xxx` | ✅ Spans processed |
| `JWT verification failed: invalid signature` | ❌ Secret mismatch |

**Useful filters**:
```
resource.type="cloud_run_revision"
resource.labels.service_name="mobs-collector"
httpRequest.status=401
```

### gateway-platform-api (staging) / platform-api (production)

**What it does**: Handles deploy requests, signs JWTs for servers, manages projects.

**Location**: Cloud Run → `gateway-platform-api` or `platform-api`

**What to look for**:

| Log Pattern | Meaning |
|-------------|---------|
| `[SERVER DEPLOY] JWT_SECRET has whitespace` | ⚠️ Secret has trailing whitespace |
| `POST 200 /v1/server/projects` | ✅ Server deploy request succeeded |
| `GET 401 /v1/auth/me` | ⚠️ Auth request failed (may be normal in refresh flow) |

**Useful filters**:
```
resource.type="cloud_run_revision"
resource.labels.service_name="gateway-platform-api"
jsonPayload.message=~"SERVER DEPLOY"
```

### studio-runner

**What it does**: Manages Studio deployments via Daytona, signs JWTs for studios.

**Location**: Cloud Run → `studio-runner`

**What to look for**:

| Log Pattern | Meaning |
|-------------|---------|
| `Sandbox created` | ✅ Daytona sandbox started |
| `Health check passed` | ✅ Studio is running |
| `Deploy failed` | ❌ Something went wrong |

### mobs-query

**What it does**: Serves trace queries to Studio UI.

**Location**: Cloud Run → `mobs-query`

**What to look for**:

| Log Pattern | Meaning |
|-------------|---------|
| `GET 200 /traces` | ✅ Trace query succeeded |
| `GET 401 /traces` | ❌ Session auth failed |

## Debugging Workflow

### "Server traces not appearing in Studio"

```
Step 1: Send a test request to your deployed server
        curl -X POST https://project.server.staging.mastra.cloud/api/agents/weather-agent/generate ...

Step 2: Check mobs-collector logs (within 30 seconds)
        
        If POST 200 → Traces received, check mobs-query or ClickHouse
        If POST 401 → JWT issue, check common-errors.md
        If POST 404 → Endpoint path issue
        If no request → MASTRA_CLOUD_TRACES_ENDPOINT not set

Step 3: If POST 200 but traces still not visible:
        - Check mobs-query logs for errors
        - Verify projectId matches between server and Studio
        - Wait a few seconds and refresh Studio
```

### "Deploy failing"

```
Step 1: Check gateway-platform-api logs for deploy request
        Filter: jsonPayload.message=~"deploy"

Step 2: If server deploy, check for JWT signing logs
        Filter: jsonPayload.message=~"JWT"

Step 3: For studio deploy, also check studio-runner logs
        Filter: jsonPayload.message=~"sandbox"
```

## Log Queries

### Find all 401 errors in the last hour
```
resource.type="cloud_run_revision"
httpRequest.status=401
timestamp>="2026-04-07T00:00:00Z"
```

### Find trace ingestion for a specific project
```
resource.type="cloud_run_revision"
resource.labels.service_name="mobs-collector"
jsonPayload.message=~"<your-project-id>"
```

### Find JWT errors
```
resource.type="cloud_run_revision"
jsonPayload.message=~"JWT"
severity>=WARNING
```

## Checking Service Configuration

### View Environment Variables

1. Go to Cloud Run → Select service
2. Click **Edit & Deploy New Revision**
3. Go to **Variables & Secrets** tab
4. Check the configured variables

### View Secret References

Look for variables marked with a key icon (🔑) - these pull from Secret Manager.

To check the actual secret value:
1. Go to **Secret Manager** in GCP Console
2. Find the secret (e.g., `GATEWAY_JWT_SECRET`)
3. View versions and access timestamps

### Recent Deployments

1. Go to Cloud Run → Select service
2. Click **Revisions** tab
3. See deployment history with timestamps

## Service URLs

Service URLs can be found in the GCP Console under Cloud Run for each environment.

Key services to look for:
- `mobs-collector` - Receives trace spans
- `gateway-platform-api` / `platform-api` - Handles deploys
- `studio-runner` - Manages studio sandboxes
- `mobs-query` - Serves trace queries

## Pub/Sub Topics

If traces are received by mobs-collector but not appearing:

1. Go to **Pub/Sub** in GCP Console
2. Check topic `platform.ai-spans` (staging) or `prod.platform.ai-spans` (production)
3. Look at subscription metrics for `mobs-ch-writer`
4. Check for unacknowledged messages (indicates writer issues)

## ClickHouse

Traces are stored in ClickHouse. If you have direct access:

```sql
SELECT * FROM mastra_ai_spans 
WHERE project_id = 'your-project-id'
ORDER BY timestamp DESC
LIMIT 10;
```
