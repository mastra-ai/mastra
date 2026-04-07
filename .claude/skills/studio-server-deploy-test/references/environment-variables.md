# Environment Variables Reference

## CLI / Local Environment

| Variable | Purpose | Values |
|----------|---------|--------|
| `MASTRA_PLATFORM_API_URL` | Determines staging vs production | `https://platform.staging.mastra.ai` (staging) or `https://platform.mastra.ai` (production, default) |
| `OPENAI_API_KEY` | OpenAI API authentication | Your API key |
| `ANTHROPIC_API_KEY` | Anthropic API authentication | Your API key |

## Deployed Server/Studio Environment

These are injected by the platform during deployment:

| Variable | Purpose | Set By |
|----------|---------|--------|
| `MASTRA_CLOUD_ACCESS_TOKEN` | JWT for authenticating trace requests to mobs-collector | `gateway-api` (server) or `studio-runner` (studio) |
| `MASTRA_CLOUD_TRACES_ENDPOINT` | Where to send traces | Platform config (must include `/ai/spans/publish`) |
| `MASTRA_SHARED_API_URL` | Platform API URL for auth proxying (Studio only) | `studio-runner` |
| `MASTRA_COOKIE_DOMAIN` | Cookie domain for deployed studios | `studio-runner` (`.mastra.cloud`) |

## Platform Services (GCP Cloud Run)

### gateway-api / platform-api

| Variable | Purpose | Source |
|----------|---------|--------|
| `GATEWAY_JWT_SECRET` | Signs JWTs for server deployments | GCP Secret Manager |
| `MASTRA_CLOUD_TRACES_ENDPOINT` | Passed to deployed servers | Terraform config |
| `WORKOS_API_KEY` | WorkOS authentication | GCP Secret Manager |
| `WORKOS_CLIENT_ID` | WorkOS client identifier | GCP Secret Manager |
| `WORKOS_COOKIE_PASSWORD` | Encrypts session cookies | GCP Secret Manager |
| `COOKIE_DOMAIN` | Domain for session cookies | Terraform (`staging.mastra.ai` or `mastra.ai`) |

### studio-runner

| Variable | Purpose | Source |
|----------|---------|--------|
| `GATEWAY_JWT_SECRET` | Signs JWTs for studio deployments | GCP Secret Manager |
| `MASTRA_CLOUD_TRACES_ENDPOINT` | Passed to deployed studios | Terraform config |
| `MASTRA_COOKIE_DOMAIN` | Cookie domain for deployed studios | Terraform (`.mastra.cloud`) |
| `MASTRA_SHARED_API_URL` | Platform API URL for auth | Terraform |
| `DAYTONA_API_KEY` | Daytona sandbox management | GCP Secret Manager |
| `RUNNER_SECRET` | Internal auth | GCP Secret Manager |

### mobs-collector

| Variable | Purpose | Source |
|----------|---------|--------|
| `GATEWAY_JWT_SECRET` | Verifies incoming trace JWTs | GCP Secret Manager |
| `MOBS_AI_SPANS_PUBSUB_TOPIC` | Pub/Sub topic for spans | Terraform |
| `MOBS_LOGS_PUBSUB_TOPIC` | Pub/Sub topic for logs | Terraform |

### mobs-query

| Variable | Purpose | Source |
|----------|---------|--------|
| `COOKIE_DOMAIN` | For session validation | Terraform |
| (Uses ClickHouse connection for queries) | | |

## Critical Configuration Rules

### 1. JWT Secret Consistency

**All three services MUST use the same secret:**

```
gateway-api    → GATEWAY_JWT_SECRET (signs server tokens)
studio-runner  → GATEWAY_JWT_SECRET (signs studio tokens)  
mobs-collector → GATEWAY_JWT_SECRET (verifies all tokens)
```

If any service uses a different secret name (e.g., `JWT_SECRET`), you'll get `401 invalid signature` errors.

### 2. Traces Endpoint Path

**MUST include `/ai/spans/publish`:**

```hcl
# Correct
"MASTRA_CLOUD_TRACES_ENDPOINT" = "${module.mobs_collector.service_url}/ai/spans/publish"

# Wrong - will cause 404 errors
"MASTRA_CLOUD_TRACES_ENDPOINT" = "${module.mobs_collector.service_url}"
```

### 3. Cookie Domains

| Service | Cookie Domain | Why |
|---------|---------------|-----|
| Platform API | `staging.mastra.ai` / `mastra.ai` | Platform authentication |
| Deployed Studio | `.mastra.cloud` | Studio sandbox authentication |

⚠️ These are intentionally different domains, which causes the "Session expired" issue.

## Terraform Configuration Locations

In the `infrastructure` repository:

```
projects/gateway/
├── staging/
│   ├── gateway-api.tf      # platform-api for staging
│   ├── studio-runner.tf    # studio-runner for staging
│   └── mobs-collector.tf   # mobs-collector for staging
└── production/
    ├── platform-api.tf     # platform-api for production
    ├── studio-runner.tf    # studio-runner for production
    └── mobs-collector.tf   # mobs-collector for production
```

## Checking Environment Variables

### On Deployed Server (if debug endpoint exists)
```bash
curl https://<project>.server.<env>.mastra.cloud/debug/env
```

### In GCP Console
1. Go to Cloud Run
2. Select the service
3. Click "Edit & Deploy New Revision"
4. Check "Variables & Secrets" tab

### From CLI (for local env)
```bash
echo $MASTRA_PLATFORM_API_URL
echo $OPENAI_API_KEY
```
