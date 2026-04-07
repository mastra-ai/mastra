# Common Errors and Fixes

## 1. `401 invalid signature` in mobs-collector logs

### Symptoms
- Server API calls succeed but traces don't appear in Studio
- `mobs-collector` logs show:
  ```
  JWT verification failed: { error: 'invalid signature', name: 'JsonWebTokenError' }
  POST 401 /ai/spans/publish
  ```

### Cause
JWT_SECRET mismatch between the service that signed the token and mobs-collector.

Common scenarios:
- `gateway-api` uses `GATEWAY_JWT_SECRET` but `mobs-collector` uses `JWT_SECRET`
- Secret was rotated but services weren't all redeployed
- Secret has trailing whitespace (historical bug, fixed in PR #462)

### Debug Steps
1. Check `mobs-collector` logs for the unverified JWT claims:
   ```
   [AUTH] Unverified JWT claims: { teamId, projectId, buildId, exp, iat }
   ```
2. Compare `buildId` with your recent deploy to confirm it's your request
3. Check which secret each service is configured to use

### Fix
1. Ensure all services use `GATEWAY_JWT_SECRET` in Terraform:
   - `gateway-api.tf` / `platform-api.tf`
   - `studio-runner.tf`
   - `mobs-collector.tf`

2. Redeploy all three services in GCP

3. Redeploy your server to get a fresh token:
   ```bash
   pnpx mastra@latest server deploy -y
   ```

---

## 2. `404` errors on trace ingestion

### Symptoms
- Traces not appearing
- `mobs-collector` logs show `POST 404` to root path `/`

### Cause
`MASTRA_CLOUD_TRACES_ENDPOINT` is missing the `/ai/spans/publish` path.

Wrong:
```
MASTRA_CLOUD_TRACES_ENDPOINT = "https://mobs-collector-xxx.run.app"
```

Correct:
```
MASTRA_CLOUD_TRACES_ENDPOINT = "https://mobs-collector-xxx.run.app/ai/spans/publish"
```

### Fix
Update Terraform configuration:
```hcl
"MASTRA_CLOUD_TRACES_ENDPOINT" = "${module.mobs_collector.service_url}/ai/spans/publish"
```

Then redeploy `gateway-api` and `studio-runner`.

---

## 3. "mastra-cloud-observability-exporter disabled" in deploy logs

### Symptoms
- Deploy succeeds but logs show:
  ```
  mastra-cloud-observability-exporter disabled: MASTRA_CLOUD_ACCESS_TOKEN environment variable not set.
  ```
- Traces never appear

### Cause
The platform-api couldn't generate a `MASTRA_CLOUD_ACCESS_TOKEN` because `GATEWAY_JWT_SECRET` (or `JWT_SECRET`) is not configured.

### Fix
1. Add `GATEWAY_JWT_SECRET` to the platform-api service's secrets in Terraform
2. Ensure the secret exists in GCP Secret Manager
3. Redeploy platform-api
4. Redeploy your server

---

## 4. "Session expired" errors in Studio logs

### Symptoms
- Studio's Logs tab shows recurring "Session expired" errors
- `gateway-platform-api` logs show `GET /v1/auth/me` returning `401`
- Sometimes affects Traces tab loading

### Cause
Cookie domain mismatch between Platform API and deployed Studio:
- Platform API sets cookies for `*.mastra.ai`
- Deployed Studio runs on `*.mastra.cloud`

The `wos-session` cookie from one domain isn't valid for the other.

### Status
**Known issue**. Workaround: Re-authenticate when session expires.

---

## 5. Studio traces appear, Server traces don't

### Symptoms
- Chatting in Studio UI generates visible traces
- Calling Server API directly doesn't show traces in Studio

### Likely Causes (check in order)

1. **Server deployed before platform-api was fixed**
   - The server has an old/invalid token
   - Fix: Redeploy the server
   ```bash
   pnpx mastra@latest server deploy -y
   ```

2. **`MASTRA_CLOUD_TRACES_ENDPOINT` not set on gateway-api**
   - Server doesn't know where to send traces
   - Check Terraform config

3. **JWT_SECRET mismatch**
   - See Error #1 above

### Debug Flow
```
1. Send server request → Note trace ID from response headers
2. Check mobs-collector logs:
   - POST 200 → Traces received, check mobs-query/ClickHouse
   - POST 401 → JWT issue (Error #1)
   - POST 404 → Endpoint path issue (Error #2)
   - No request → MASTRA_CLOUD_TRACES_ENDPOINT not set (Error #3)
```

---

## 6. Deploy hangs or times out

### Symptoms
- `mastra studio deploy` or `mastra server deploy` hangs at "Streaming deploy logs..."
- Eventually times out

### Causes
1. **Network issues** - Platform API unreachable
2. **Sandbox creation slow** - Daytona taking longer than usual
3. **Build failed silently** - Check platform-api logs

### Workarounds
1. Check if deploy actually succeeded:
   - Visit the Studio/Server URL directly
   - Check `studio.mastra.ai` or `studio.staging.mastra.ai` dashboard

2. Retry the deploy:
   ```bash
   pnpx mastra@latest server deploy -y
   ```

3. If repeated failures, check GCP logs for `studio-runner` or `gateway-platform-api`

---

## 7. "Cannot determine project name" error

### Symptoms
```
Error: Could not determine project name from package.json.
```

### Cause
Running deploy from wrong directory, or `package.json` missing `name` field.

### Fix
1. Ensure you're in the project root (where `package.json` is)
2. Verify `package.json` has a `name` field
3. Use explicit project name:
   ```bash
   pnpx mastra@latest server deploy --project my-project-name -y
   ```

---

## Quick Reference: Error → Most Likely Fix

| Error | Quick Fix |
|-------|-----------|
| `401 invalid signature` | Redeploy all platform services + your server |
| `404` on traces | Add `/ai/spans/publish` to endpoint config |
| "exporter disabled" | Add `GATEWAY_JWT_SECRET` to platform-api |
| "Session expired" | Re-authenticate (known issue) |
| Studio traces work, server doesn't | Redeploy your server |
| Deploy timeout | Check URL directly, retry deploy |
