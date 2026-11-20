# Provider setup

The default environment is designed for Studio and needs only a model credential. Enable external integrations in a separate staging environment before adopting production credentials.

Start from the example file:

```sh
cp .env.example .env
```

For an integrated environment, set:

```dotenv
RUNTIME_MODE=staging
WEBHOOKS_ENABLED=true
```

Provider flags are independent. IPinfo is optional in staging and production. Startup rejects explicitly enabled integrations when their configuration is incomplete.

For the complete staging path through human approval, enable both WorkOS and Linear. WorkOS supplies authoritative identity reads and approved mutations; Linear must successfully create an external incident before the workflow suspends. IPinfo supplies the authoritative public-IP country observation. A policy-proven allowed-country login closes locally as benign before approval and before any Linear write. Domain event delivery defaults to in-process; customers can inject a native transport using the [PubSub contract](local-pubsub.md). The transactional LibSQL outbox remains the durable source of truth. No Redis or new real driver is required for the functional local path.

## Application-generated secrets

These values do not come from WorkOS or another provider:

```sh
openssl rand -hex 32 # ALERT_WEBHOOK_SECRET
openssl rand -hex 32 # WORKOS_COOKIE_PASSWORD
openssl rand -hex 32 # DASHBOARD_CSRF_SECRET
openssl rand -hex 32 # APPROVAL_RESUME_SECRET (staging and production)
openssl rand -base64 32 # key material for GEOIP_CACHE_HMAC_KEY
```

Generate each value independently and store it in your secret manager. Configure the GeoIP key with an encoding prefix:

```dotenv
ALERT_WEBHOOK_SECRET=<hex-value>
WORKOS_COOKIE_PASSWORD=<different-hex-value>
DASHBOARD_CSRF_SECRET=<different-hex-value>
APPROVAL_RESUME_SECRET=<different-hex-value-for-hosted-environments>
GEOIP_CACHE_HMAC_KEY=base64:<base64-value>
GEOIP_CACHE_HMAC_KEY_VERSION=hmac-sha256-v1
```

`ALERT_WEBHOOK_SECRET` authenticates your organization’s normalized alert producers. `WORKOS_COOKIE_PASSWORD` encrypts and authenticates dashboard sessions. `DASHBOARD_CSRF_SECRET` protects state-changing dashboard requests. In local mode the application derives a purpose-bound workflow-resume key from the CSRF secret, so no additional setup is required. Staging and production must configure an independent `APPROVAL_RESUME_SECRET`. The GeoIP HMAC key creates non-reversible cache identifiers for IP addresses.

## WorkOS

Use the WorkOS staging environment first; its resources and credentials are separate from production.

1. In the WorkOS dashboard, select the staging environment and create an API key.
2. Copy its Client ID.
3. Add `http://localhost:3000/auth/callback` as a redirect URI for local access.
4. Create or select a staging organization and add the identities monitored by the workflow. Copy the organization ID and exact application role slugs.
5. In **Authorization → Roles**, create the dashboard operator roles `viewer`, `soc-analyst`, and `soc-manager`. Assign exactly one of them to each operator's active organization membership. The application maps these WorkOS slugs to its internal `viewer`, `soc_analyst`, and `soc_manager` roles; only `soc-manager` can approve or reject containment.
6. Expose local port `3000` through a trusted HTTPS tunnel if WorkOS must deliver events to your machine. The complete ngrok walkthrough and test expectations are in [Getting started](getting-started.md#test-workos-locally-through-ngrok).
7. Register `https://<public-host>/webhooks/workos` as a webhook endpoint, select the membership and session events used by your policy, and copy its signing secret.

Use the same hostname in `DASHBOARD_ORIGIN`, `WORKOS_REDIRECT_URI`, and the browser (do not mix `localhost` and `127.0.0.1`). HTTP loopback origins use Safari-compatible local cookies; hosted staging and production origins must use HTTPS. After changing the origin or cookie configuration, restart the app and start a new sign-in from `/auth/login` instead of reloading an old callback URL.

```dotenv
WORKOS_PROVIDER_ENABLED=true
WORKOS_API_KEY=<staging-api-key>
WORKOS_WEBHOOK_SECRET=<endpoint-signing-secret>
WORKOS_ORGANIZATION_ID=<organization-id>
WORKOS_ALLOWED_ROLE_SLUGS=member,admin

DEVICE_TRUST_PROVIDER_ENABLED=true
DEVICE_TRUST_ALERT_SOURCE=first-party-device-trust
ALERT_WEBHOOK_SOURCES=reference-auth,first-party-device-trust

DASHBOARD_AUTH_ENABLED=true
WORKOS_CLIENT_ID=<staging-client-id>
WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
WORKOS_COOKIE_PASSWORD=<application-generated-secret>
DASHBOARD_CSRF_SECRET=<application-generated-secret>
APPROVAL_RESUME_SECRET=<application-generated-secret>
```

The configured organization and role slugs bound containment. The provider verifies active organization membership through WorkOS before accessing user/session evidence or executing containment; signed webhooks must match the configured organization. Operator permissions and approval requirements still apply.

`WORKOS_ALLOWED_USER_IDS` is optional. Omit it or leave it empty to monitor users in the configured organization without maintaining IDs in the environment. For restricted tests, set a comma-separated list of user IDs to further restrict webhook intake and provider actions. A nonempty list never bypasses organization membership checks.

In staging and production, containment planning is also limited to mutations implemented by the configured identity provider. With the supplied WorkOS adapter, plans may contain only exact-session revocation and previous-role restoration. Local-only actions such as `require_reauthentication` and `mark_device_for_review` are removed before approval rather than failing during execution.

Session revocation uses two official confirmation paths: the WorkOS session readback and the durable signed `session.revoked` webhook. WorkOS may remove a revoked session from `listSessions`; in that case, a webhook bound to the exact tenant, user, and session reconciles an uncertain effect without issuing the mutation again.

`WORKOS_ALLOWED_ROLE_SLUGS` controls which application-role changes the workflow may investigate or contain; it does not grant access to the operations dashboard. Dashboard authorization uses the separate WorkOS operator roles `viewer`, `soc-analyst`, and `soc-manager` carried in the authenticated session. Generic WorkOS roles such as `member` and `admin` are intentionally not promoted to SOC privileges.

See the official WorkOS guides for [staging and production environments](https://workos.com/docs/authkit/environments), [AuthKit](https://workos.com/docs/authkit/overview), and [webhooks](https://workos.com/docs/events/data-syncing/webhooks).

The WorkOS webhook endpoint accepts only `organization_membership.updated`, `session.created`, and `session.revoked`. A dashboard sample event can validate the tunnel and signature but may be dead-lettered because its sample organization/user does not match the configured allowlists. Use a controlled action on a staging identity in the configured organization to validate normalization, provider reads, workflow execution, and dashboard state end to end.

## First-party device trust

WorkOS supplies the real user and session boundary; it does not supply a signed device identifier. The optional first-party provider closes that gap explicitly. `trigger:device` generates an ephemeral Ed25519 key, stores only its public attestation, and sends a fresh HMAC-authenticated normalized alert. The endpoint evidence adapter verifies the signature and the exact tenant/user/session/event scope before consulting `authorized_devices`.

Authorization is separate from login. Only an authenticated `soc-manager`, revalidated through WorkOS on the mutation, can authorize or revoke a device from its incident page. The authoritative registry and append-only decision audit stay tenant-scoped in the application database. Do not put the device list in WorkOS user metadata: that metadata is global to the user, size-limited, and not an appropriate tenant-scoped authorization ledger.

This implementation demonstrates software-key identity. Replace it with hardware-backed WebAuthn, MDM, EDR, or platform attestation when the threat model requires proof that a key cannot be exported.

## IPinfo

IPinfo is optional in every mode. Without it, hosted runtimes leave the observed country unavailable and the workflow requires manual review when that evidence is necessary; synthetic country and session-history facts are restricted to local mode. Create an IPinfo account and copy the access token shown in its dashboard:

```dotenv
IPINFO_PROVIDER_ENABLED=true
IPINFO_TOKEN=<access-token>
GEOIP_CACHE_HMAC_KEY=base64:<32-byte-key-material>
GEOIP_CACHE_HMAC_KEY_VERSION=hmac-sha256-v1
```

Keep the HMAC key stable across restarts so existing cache entries remain addressable. Key rotation is supported through the previous-key settings in the runtime configuration, but those values are intentionally absent from `.env.example` because they are needed only during an active rotation.

The executable `trigger:country` command requires an explicit public `--ip`. It resolves that address through the same provider and durable cache before creating the WorkOS session. The redacted command result reports `incident` for a country outside the US-only reference policy and `benign-closed` for US.

IPinfo documents token retrieval and authentication in its [developer guide](https://ipinfo.io/developers).

## Linear

For a workspace-owned deployment, create a personal API key under Linear settings. For a product installed by multiple customers, Linear recommends OAuth 2.0; the current adapter accepts a server-side access token through `LINEAR_API_KEY`, so token acquisition and rotation belong in the deployment’s credential layer.

Only the destination workspace/team and optional project use IDs. The adapter discovers workflow states in the configured team and resolves labels by name; you do not need label or workflow-state IDs.

Without overrides, `received` uses Backlog, active/review/failed phases use In Progress, `contained` and `closed` use Done, and `rejected` uses Canceled. Discovery uses Linear's state type, preferring these standard names; otherwise it picks the first state in workflow order for that type. Custom names and localized names work through the optional partial maps below. A configured name must match exactly one available item (case-insensitive, surrounding whitespace ignored); missing or ambiguous names fail before writing the issue.

Existing labels named Low, Medium, High, and Critical are discovered automatically. Team labels take precedence over workspace labels with the same name; labels from other teams and label groups are excluded. Missing or ambiguous default labels are omitted, while native severity priorities always apply (critical=1, high=2, medium=3, low=4). No labels or states are created automatically.

```dotenv
LINEAR_PROVIDER_ENABLED=true
LINEAR_API_KEY=<personal-or-oauth-access-token>
LINEAR_WORKSPACE_ID=<workspace-id>
LINEAR_TEAM_ID=<team-id>
LINEAR_PROJECT_ID=<optional-project-id>
LINEAR_INTERNAL_BASE_URL=https://security.example.com/dashboard
```

Optional overrides use names only; omit either setting to keep automatic discovery:

```dotenv
LINEAR_SEVERITY_LABEL_NAMES_JSON={"high":"High severity","critical":"Critical severity"}
LINEAR_STATUS_STATE_NAMES_JSON={"awaiting_approval":"In Review","contained":"Done","closed":"Done"}
```

Only supplied entries are overridden. Names are resolved after validating the workspace/team/project, and the resolved IDs are cached for the provider lifetime. Restart after renaming items or changing configuration. The older `*_IDS_JSON` maps remain supported for existing deployments; a name override takes precedence for the same entry.

`LINEAR_INTERNAL_BASE_URL` is your dashboard base URL, not a Linear endpoint. The adapter appends `incidents/<incidentId>` and places that internal link in the Linear issue. It must be HTTPS outside local development.

Use the official Linear documentation for [GraphQL identifiers](https://linear.app/developers/graphql) and [OAuth 2.0](https://linear.app/developers/oauth-2-0-authentication).

## Normalized alert producers

Systems other than WorkOS send the normalized alert contract to `POST /webhooks/alerts`.

```dotenv
ALERT_WEBHOOK_SECRET=<application-generated-secret>
ALERT_WEBHOOK_SOURCES=identity-monitor,siem,edr
```

Each producer must calculate the request signature exactly as the project’s signing helper does and use a stable source name from the allowlist. Put the shared secret in the producer and receiver secret stores; never include it in the payload.

## Production checklist

- Create new provider credentials; never promote staging keys.
- Replace localhost and tunnel addresses with stable HTTPS origins.
- Keep application-generated secrets in a managed secret store and define a rotation process.
- Reduce WorkOS and Linear access to the minimum scopes required by the adapter.
- Keep tenant, role, source, and destination restrictions explicit; use the optional user allowlist when a smaller test scope is needed.
- Validate webhook retry behavior, idempotency, outbox recovery, and approval expiry under failure.
- Export audit traces to your security archive and define evidence-retention ownership.
- Run the project’s evaluation suite against organization-specific alerts and runbooks before enabling provider writes.

Run hosted integrations with `npm run dev:server` during development or `npm run build && npm start` for deployment. `npm run dev` can start Hono and Studio together to inspect integrated runs; `npm run dev:studio` starts Studio separately. Pasted fixtures and simulated decisions remain restricted to isolated local providers. Keep Studio private to development: its generic control plane does not enforce the dashboard's domain tenant authorization.
