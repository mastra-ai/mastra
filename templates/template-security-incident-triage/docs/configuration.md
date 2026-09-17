# Configuration

Copy `.env.example` to `.env` and set only `OPENAI_API_KEY`. `npm run dev` starts the API and Studio in local mode, creates the local database and indexes the included runbooks. The first run needs network access for the embedding model download. No remote identity, ticketing or GeoIP account is needed. Local providers are synthetic and never contain real identities.

`RUNTIME_MODE` defaults to `local`; set `staging` or `production` explicitly for hosted deployments. `NODE_ENV` does not select providers. Provider and dashboard flags default to `false`; a flag set to `true` requires its complete configuration and never silently falls back. Setting credentials alone does not enable remote effects. `WEBHOOKS_ENABLED` also defaults to `false`.

## Required settings by capability

| Capability          | Required settings                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Default model       | `OPENAI_API_KEY`                                                                                                                                                                           |
| Hosted approval     | `APPROVAL_RESUME_SECRET` (at least 32 characters)                                                                                                                                          |
| Signed alert intake | `WEBHOOKS_ENABLED=true`, `ALERT_WEBHOOK_SECRET` (at least 16 characters)                                                                                                                   |
| WorkOS              | `WORKOS_PROVIDER_ENABLED=true`, signed intake, `WORKOS_API_KEY`, `WORKOS_WEBHOOK_SECRET`, `WORKOS_ORGANIZATION_ID`, `WORKOS_ALLOWED_ROLE_SLUGS`                                            |
| Dashboard           | `DASHBOARD_AUTH_ENABLED=true`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_REDIRECT_URI`, `WORKOS_COOKIE_PASSWORD`, `DASHBOARD_CSRF_SECRET`; set `DASHBOARD_ORIGIN` to the public origin |
| Device trust        | `DEVICE_TRUST_PROVIDER_ENABLED=true`, signed intake                                                                                                                                        |
| IPinfo              | `IPINFO_PROVIDER_ENABLED=true`, `IPINFO_TOKEN`, `GEOIP_CACHE_HMAC_KEY`, `GEOIP_CACHE_HMAC_KEY_VERSION`                                                                                     |
| Linear              | `LINEAR_PROVIDER_ENABLED=true`, `LINEAR_API_KEY`, `LINEAR_WORKSPACE_ID`, `LINEAR_TEAM_ID`, `LINEAR_INTERNAL_BASE_URL`                                                                      |

WorkOS containment is scoped to the configured organization and allowed roles. The user allowlist is optional; when omitted, the organization defines the user scope. Local mode requires neither list. The organization and Linear destination IDs bind operations to their intended tenant and workspace.

Generate independent application secrets with `openssl rand -hex 32`. GeoIP keys require `hex:` or `base64:` followed by at least 32 decoded bytes. No example credential is valid or supplied. Secrets with surrounding whitespace are rejected. Startup errors identify fields without printing their values.

## Optional defaults

- `MASTRA_MODEL=openai/gpt-4o-mini`; another Mastra model identifier requires that provider's authentication configuration. OpenAI startup validation applies to `openai/` models.
- `MASTRA_STORAGE_URL=file:./incident.db` in the example; omitting the setting retains the compatible `file:./mastra.db` default. `MASTRA_STORAGE_AUTH_TOKEN` is optional for authenticated remote LibSQL. Keep storage persistent across restarts.
- `PORT=3000`, `RUNBOOK_FASTEMBED_CACHE_DIR=.cache/fastembed`. Local HTTP binds to `127.0.0.1`; hosted HTTP binds to `0.0.0.0`. The development launcher rejects an occupied port before preparing storage.
- `ALERT_WEBHOOK_SOURCES=reference-auth`; explicit source lists restrict signed producers. `DEVICE_TRUST_ALERT_SOURCE=first-party-device-trust`.
- `EVIDENCE_IDENTITY_TIMEOUT_MS=4000`, `EVIDENCE_ENDPOINT_TIMEOUT_MS=1500`, `EVIDENCE_CLOUD_TIMEOUT_MS=1500`, `IPINFO_TIMEOUT_MS=1500`.
- `WEBHOOK_MAX_BODY_BYTES=65536`, `MASTRA_MAX_BODY_BYTES=1048576`.
- `OUTBOX_POLL_INTERVAL_MS=250`, `OUTBOX_BATCH_SIZE=16`, `OUTBOX_LEASE_MS=10000`, `OUTBOX_MAX_ATTEMPTS=5`, `OUTBOX_BACKOFF_BASE_MS=500`, `OUTBOX_BACKOFF_CAP_MS=30000`, `OUTBOX_RECOVERY_GRACE_MS=10000`.
- `CONTAINMENT_ACTION_TIMEOUT_MS=1000`, `CONTAINMENT_RATE_LIMIT=8`.
- `DASHBOARD_ORIGIN=http://localhost:3000`, `DASHBOARD_SESSION_MAX_AGE_SECONDS=28800`, `DASHBOARD_SSE_MAX_CONNECTIONS=4`, `DASHBOARD_TRUSTED_PROXY=false`. Enable trusted proxy handling only behind your controlled proxy.
- Dashboard cookies use `Secure` and the `__Host-` prefix. For HTTP on exactly `localhost`, `127.0.0.1`, or `[::1]`, they use separate `authkit-local-` names without `Secure` so Safari can retain login state. Both modes use `HttpOnly`, `SameSite=Lax`, and `Path=/`. This choice follows `DASHBOARD_ORIGIN`, never request or proxy headers; hosted deployments require HTTPS.
- `LINEAR_PROJECT_ID` is optional. Workflow states and severity labels are discovered automatically. Optional partial `LINEAR_SEVERITY_LABEL_NAMES_JSON` and `LINEAR_STATUS_STATE_NAMES_JSON` overrides use names, not IDs. Legacy ID maps remain supported. See [provider setup](provider-setup.md).

GeoIP confidence (0.7), cache TTL (86400 seconds) and evidence retention (30 days) are policy constants, not environment settings. Change and review the policy in code if needed.

## Advanced operations

`WORKOS_WEBHOOK_PREVIOUS_SECRET` supports webhook secret rotation. `GEOIP_CACHE_HMAC_PREVIOUS_KEY` and `GEOIP_CACHE_HMAC_PREVIOUS_KEY_VERSION` must be supplied together during cache-key rotation; current and previous values must differ.

Local signed approval is optional: `LOCAL_APPROVALS_ENABLED=true` requires `LOCAL_APPROVAL_SECRET` and `APPROVAL_RESUME_SECRET`, each at least 32 characters. In local mode these keys can instead be derived with distinct purposes from `DASHBOARD_CSRF_SECRET`. Hosted mode rejects local approvals. The [Studio walkthrough](how-to-test-studio.md) uses the Resume input instead and needs neither setting. See [provider setup](provider-setup.md) for authenticated approval.

`RETENTION_SCHEDULER_ENABLED=false` by default. Enabling it requires `RETENTION_TENANT_ID`, `RETENTION_SWEEP_LIMIT` (1–1024), and `RETENTION_SWEEP_MAX_BATCHES` (1–64). The tenant is an authorization boundary; batch bounds limit deletion work. See [monitoring](monitoring.md).

Fixture-only settings (`ALERT_WEBHOOK_URL`, `INCIDENT_TENANT_ID`, `INCIDENT_SUBJECT_ID`, `INCIDENT_ACTOR_ID`, `INCIDENT_SESSION_ID`, `INCIDENT_DEVICE_ID`, `COUNTRY_LOGIN_IP`, `UNKNOWN_DEVICE_IP`, `PREVIOUS_ROLE`, `NEXT_ROLE`) customize sample input, not startup. See [getting started](getting-started.md).

## Hosted startup

Use `npm install`, `npm run build`, then `npm start`. Use `npm run dev:server` for hosted integration development. The development launcher can start Studio alongside Hono in any runtime mode. Pasted alerts and simulated approvals are available only in local mode with external integrations disabled; integrated runs enter through signed Hono webhooks and require authenticated approval. Studio is a development control plane, not the hosted dashboard. The Hono generic `/api` control plane is unavailable outside local mode; dashboard routes authenticate sessions and enforce tenant scope independently.

Production does not automatically activate changed runbooks: review them and run `npm run runbooks:index` against the deployment database before accepting alerts. Runbook administration commands load `.env`; offline validation, demos and evals intentionally do not.

Disabled identity/device integrations report unavailable evidence. Hosted runtimes never invent observed country or session-history facts. Missing required evidence results in manual review. A disabled external incident provider does not create a remote ticket.
