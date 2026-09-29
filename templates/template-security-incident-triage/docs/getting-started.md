# Getting started

For the shortest path with only an OpenAI API key, follow the [Studio walkthrough](how-to-test-studio.md).

For an automated, credential-free walkthrough, start with the [local demo](local-demo.md): `npm run demo:local -- --output /tmp/security-local-demo` (choose a new directory). It uses the real signed-webhook and background workflow boundaries with deterministic invokers; no model key, provider account, `.env` or Redis is required. The interactive Studio path below does require a model key.

This guide runs the same incident workflow through three boundaries: local fixture input in Studio, a locally signed fixture sent to the normalized-alert endpoint, and real WorkOS staging webhooks. The workflow graph is unchanged; only the intake and provider adapters differ. Fixtures are never a staging path.

## Prerequisites

- Node.js `^22.22.0 || >=24.12.0`
- an API key for the model selected by `MASTRA_MODEL`
- provider staging accounts only for the external path
- ngrok only when WorkOS needs to call the local Hono server

Install the project and create the local configuration:

```sh
npm install
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env`, then start Hono and Mastra Studio together:

```sh
npm run dev
```

| Surface              | Address                           | Purpose                                                                                                 |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Mastra Studio        | `http://localhost:4111`           | Inspect the workflow graph, input, steps, state, and output.                                            |
| Hono API             | `http://localhost:3000`           | Receive signed provider events and serve application routes.                                            |
| Operations dashboard | `http://localhost:3000/dashboard` | Review incidents and approve or reject containment after WorkOS dashboard authentication is configured. |

`npm run dev` starts both Hono and Studio in local, staging, and production modes, including with WorkOS and other integrations enabled. Both processes share `MASTRA_STORAGE_URL`, so Studio can inspect persisted workflow runs and traces. Refresh the run list to see executions started by Hono's worker. With real integrations, send events through the signed Hono webhook endpoints; pasted fixture input remains restricted to local mode without external providers. Approve containment through the authenticated dashboard. The launcher preserves the existing database in integrated modes. `npm run dev:server` and `npm run dev:studio` start each surface separately.

The dashboard is served by Hono; it is not a page inside Studio. Once dashboard authentication is enabled, `/dashboard` redirects to AuthKit and returns through `/auth/callback`.

## The common flow

All three incident kinds use one graph:

```text
signed event or Studio input
  -> normalize and persist
  -> gather identity + endpoint + cloud evidence in parallel
  -> correlate
  -> retrieve and integrity-check the runbook
  -> classify and summarize
  -> build and validate the exact containment plan
  -> create/update the external incident
  -> suspend for soc_manager approval
  -> execute, read back, verify, and finalize
```

An external webhook never starts Mastra with an untrusted provider body. Hono verifies and normalizes the body, commits the alert, incident, timeline, and outbox event, and the worker starts the workflow with durable identifiers. Studio is an exploration path: its first step persists the pasted alert through the same normalized domain boundary, but it does not emulate HTTP signature verification.

## Flow of each alert kind

### Unauthorized privilege change

Real example: an organization membership changes from `member` to `admin` without a matching approved change.

1. A normalized producer sends `unauthorized_privilege_change` to `/webhooks/alerts`, or WorkOS sends `organization_membership.updated` to `/webhooks/workos`.
2. For a WorkOS event, the intake records the current membership role and ordering position. A normal provider event uses a prior observation as its baseline. The staging CLI instead reads the official pre-change membership and records a short-lived test intent before the real update; intake binds that intent atomically to the signed WorkOS event.
3. During `gather-identity-evidence`, the WorkOS adapter calls `getUser` and `listSessions` concurrently. It returns only validated facts such as user status, matching session status/ownership, and privilege context that was already established by trusted durable state.
4. IPinfo is not called unless the alert also has an IP. The endpoint branch returns `inspectionApplicable=false`; the reference cloud branch contributes only its bounded policy facts.
5. Policy requires the previous role, current role, actor, and approval state. Native `organization_membership.updated` does not identify the actor or prove that a change was unauthorized. A manual dashboard change therefore produces manual review. The staging CLI supplies explicit `staging-trigger` test authority with `approved=false`; production must connect its real change-approval authority.
6. If the central event is proven, `RB-IDENTITY-001` permits restoring the preserved previous role and, when an exact session is proven, revoking that session. A `soc_manager` must approve the exact plan first.
7. After approval in staging, WorkOS reads the membership, checks the expected current role, records the exact callback expected from this approved effect, updates the membership to the preserved previous role, and reads it back. The result is stored as a redacted provider reference such as `workos:<membership-id>`.
8. The signed `organization_membership.updated` emitted by that rollback still advances the authoritative WorkOS state, but an exact tenant/user/membership/role match inside the short causal window is consumed once and appended to the original incident timeline. It does not create another incident or workflow. A different role, inactive membership, expired expectation, or unrelated event is investigated normally.

The local normalized fixture is useful for exercising intake and investigation, but its `changes` object is not treated as trusted authorization evidence. In staging, authority comes from the short-lived trigger intent bound to the real WorkOS event. In production, connect the change-approval system or rely on ordered WorkOS history plus a trusted authorization record.

### Login from a disallowed country

Real example: WorkOS creates a session from a public IP whose GeoIP country is outside the tenant policy.

1. A normalized producer sends `disallowed_country_login`, or WorkOS sends `session.created` or `session.revoked`.
2. The WorkOS normalizer maps the event ID to `sourceEventId`, the session timestamp to `occurredAt`, and preserves the exact session ID and optional IP.
3. During identity gathering, WorkOS calls `getUser` and `listSessions`; the named session must exist and belong to the allowed subject. The returned facts include user status, session status, and session ownership.
4. IPinfo is optional at startup, but country-based triage needs its location evidence. When the provider is enabled and a public IP exists, the GeoIP wrapper calls IPinfo Lite concurrently with WorkOS. A slow identity read cannot prevent GeoIP from starting. A known result contributes IP presence, country code, observation time, policy confidence `0.7`, and optional ASN. Private, documentation/bogon, timed-out, rate-limited, or invalid results remain `unknown`; they are not converted into evidence and safely require manual review.
5. The reference cloud adapter supplies the tenant country policy in staging, but no session-history observation. It emits neither a second country nor a duplicate IP-presence fact. It is an implementation example, not an external cloud/SIEM integration.
6. Country classification requires IP presence, country, allowed country, and exact session ownership. Recent history can raise severity; it is not required for country classification. GeoIP alone is never proof of compromise.
7. A country outside the US-only reference policy continues to summary, containment planning, Linear creation, and approval. A verified US login closes the internal record as benign before summary, approval, or any Linear write. `RB-IDENTITY-002` allows revoking only the named session or requiring reauthentication, but the workflow intersects that runbook allowlist with the active provider capabilities before persisting the plan. The supplied staging adapter therefore proposes only WorkOS session revocation and verifies it by readback after approval; `require_reauthentication` remains a local demonstration action.

The local fixture command never claims to create a WorkOS session. In staging, create a real session through AuthKit; its WorkOS webhook carries the authoritative session ID.

### Login from an unfamiliar device

Real example: an application or EDR sees a valid, application-issued device ID that is absent from the subject’s authorized-device list.

1. The staging CLI authenticates the real organization user with WorkOS Email + Password and takes the verified session ID from the returned access token without logging or persisting that token.
2. It creates an ephemeral Ed25519 key pair, derives the device ID from the public key, signs a five-minute attestation bound to the tenant, subject, session, event, and timestamps, and persists only the public proof.
3. It HMAC-signs a fresh `unknown_device_login` alert for `/webhooks/alerts`. This is an application-owned provider event, not a fixture and not a claim that WorkOS supplies device posture.
4. WorkOS is still called during identity gathering to validate the user and exact session. The endpoint adapter independently verifies the Ed25519 proof and checks the tenant/subject authorized-device table at the incident timestamp.
5. The reference cloud adapter does not supply session history outside local mode. The device policy requires that evidence, so the supplied staging setup returns `manual-review` with `REQUIRED_EVIDENCE_MISSING`. Connect an authoritative history adapter and register its evidence origin in `src/triage/policy-registry.ts` to complete this path. IPinfo cannot supply device trust or session history.
6. Policy requires the device identifier, a valid signature, authorization state, exact session ownership, and recent history. A new valid key is deliberately unknown, so it exercises the unfamiliar-device path without pretending that an invalid signature is trustworthy.
7. A `soc_manager` may authorize or revoke the device from the incident page. That separate, refreshed WorkOS session writes the tenant-scoped registry and an append-only local audit record. It does not rewrite the incident-time fact.
8. `RB-IDENTITY-003` can propose revoking the exact session and marking only the device for review. WorkOS can perform the revocation; `mark_device_for_review` remains blocked outside local mode until a customer endpoint adapter implements that write.

The built-in key is a software-key demonstration, not hardware attestation. A production deployment may replace this read adapter with an EDR, MDM, WebAuthn, or platform-attestation provider without changing the workflow contract.

These are three examples of implementing the template’s extension points. They are not three separate workflows.

## When external providers are called

| Provider                      | Call point                                                                                         | What it returns to the workflow                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| WorkOS webhook                | Before the workflow, on `POST /webhooks/workos`                                                    | A signed event that is normalized to the internal alert contract. Raw payloads do not become evidence.                               |
| WorkOS identity API           | `gather-identity-evidence`                                                                         | Validated user and session facts; trusted privilege facts only when durable context proves them.                                     |
| IPinfo Lite                   | Inside identity gathering, only when enabled and a routable IP is present                          | Country code, observation time, bounded confidence, and optional ASN; otherwise a closed `unknown` reason.                           |
| Linear                        | After the plan and approval request are persisted, before suspension; again after decision/outcome | A redacted, idempotent issue reference and later a redacted status update. In staging, enable Linear for the complete approval path. |
| WorkOS containment API        | Only after approval                                                                                | Role restoration or exact-session revocation followed by provider readback and a redacted provider reference.                        |
| Local event delivery          | Between the transactional outbox and workflow worker                                               | In-process delivery; durability and restart recovery remain in the LibSQL outbox.                                                    |
| First-party device trust      | Endpoint branch for `unknown_device_login` outside local mode                                      | Verifies the stored Ed25519 proof and tenant-scoped authorization at incident time.                                                  |
| Local endpoint/cloud adapters | In their parallel evidence branches in local mode                                                  | Deterministic fixture facts. They make no external request.                                                                          |

## Test locally with fixtures

Open **Workflows**, choose `securityIncidentWorkflow`, and paste one of these static teaching fixtures as input:

- `scripts/fixtures/unauthorized-privilege-change.json`
- `scripts/fixtures/disallowed-country-login.json`
- `scripts/fixtures/unknown-device-login.json`

To get a fresh Studio-ready input instead, run:

```sh
npm run fixture:print -- privilege
npm run fixture:print -- country
npm run fixture:print -- device
```

The command prints the raw alert object, not a delivery wrapper. On every invocation it replaces the fixture identity with:

- `sourceEventId`: the readable fixture prefix plus a random UUID suffix;
- `occurredAt`: the current UTC timestamp.

This prevents a second run from being deduplicated as the same provider event. Paste the printed JSON directly into Studio.

## How local fixture commands work

There is one command with an explicit scenario argument: `npm run fixture:print -- <privilege|country|device>` prints JSON for Studio, and `npm run fixture:send -- <scenario>` sends it to the local normalized-alert endpoint. The package command loads `.env` before TypeScript starts. The implementation then:

1. reads and schema-validates the matching fixture;
2. applies optional local-only `INCIDENT_*` and scenario overrides from `.env`;
3. generates `sourceEventId` and `occurredAt`;
4. generates related fixture session/device IDs unless local overrides were supplied;
5. schema-validates the final alert again;
6. when called through `fixture:print`, prints that raw alert and stops;
7. otherwise signs the exact JSON bytes as `HMAC-SHA256("<timestamp>.<body>")` with `ALERT_WEBHOOK_SECRET`;
8. when called through `fixture:send`, sends `POST /webhooks/alerts` with `X-Alert-Signature` and prints only Hono’s receipt.

The commands fail immediately unless `RUNTIME_MODE=local`. They do not authenticate with WorkOS, create a WorkOS session, or call any remote provider. That is intentional: a fixture is a local contract example, not a substitute for a provider event.

## Trigger a scenario in the configured mode

The convenience commands are mode-aware:

```sh
npm run trigger:privilege
npm run trigger:country
npm run trigger:device
```

With `RUNTIME_MODE=local`, they generate, sign, and send the corresponding fixture, just like `fixture:send`. With `RUNTIME_MODE=staging`, they first validate WorkOS, IPinfo, organization and role scope, webhooks, and AuthKit, then print the official provider action and expected event:

| Command             | Official staging action                                                                                         | Expected event                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `trigger:privilege` | Change a membership in the configured organization through the WorkOS API, or print the manual provider action. | `organization_membership.updated` |
| `trigger:country`   | Authenticate with Email + Password through the WorkOS API, or print the AuthKit login URL.                      | `session.created`                 |
| `trigger:device`    | Authenticate in WorkOS, generate a new Ed25519 device identity, and deliver its signed first-party alert.       | `unknown_device_login`            |

Without action flags, the staging commands only print the provider action. To execute a password login without putting the password in shell history or the process list, read it from the terminal and pipe it through stdin:

```sh
read -s WORKOS_STAGING_TEST_PASSWORD
printf '%s' "$WORKOS_STAGING_TEST_PASSWORD" | npm run trigger:country -- \
  --user=jane@doe.com \
  --password-stdin \
  --ip=200.160.2.3 \
  --user-agent=security-template-staging-test \
  --execute
unset WORKOS_STAGING_TEST_PASSWORD
```

Use the same secret-safe input for a fresh unknown device:

```sh
read -s WORKOS_STAGING_TEST_PASSWORD
printf '%s' "$WORKOS_STAGING_TEST_PASSWORD" | npm run trigger:device -- \
  --user=jane@doe.com \
  --password-stdin \
  --new-device \
  --ip=200.160.2.3 \
  --user-agent=security-template-device-test \
  --execute
unset WORKOS_STAGING_TEST_PASSWORD
```

Enable `DEVICE_TRUST_PROVIDER_ENABLED=true`, set `DEVICE_TRUST_ALERT_SOURCE=first-party-device-trust`, and include that source in `ALERT_WEBHOOK_SOURCES`. Every execution generates a distinct key, so it starts unauthorized even if a previous device was approved. The command persists no password, access token, refresh token, or private key.

The command resolves the email through WorkOS, checks the optional user allowlist when configured, authenticates with `authenticateWithPassword`, and prints only a redacted receipt. Access tokens, refresh tokens, and the password are never printed or persisted. `--pass` and `--password` are deliberately rejected. Email verification, organization selection, Radar challenges, SSO-only policies, and MFA can still require the interactive AuthKit flow.

`--ip` is required by the executable country trigger, becomes the official WorkOS session IP, and must be a controlled public address. Before authenticating, the command resolves it with IPinfo through the same durable cache used by the workflow. Its redacted receipt predicts `incident` when the country is outside the US-only reference policy or `benign-closed` for US. An unknown GeoIP result aborts before a WorkOS session is created.

To produce an intentionally unapproved promotion, run one official membership update:

Restart `npm run dev:server` after updating the template so startup applies the staging-intent migration and loads the WorkOS webhook handler. Then run:

```sh
npm run trigger:privilege -- --userId=user_123 --role=admin --execute
```

The command checks the optional user allowlist when configured, resolves exactly one active membership in `WORKOS_ORGANIZATION_ID`, reads its official previous role, and records a five-minute staging intent before calling `updateOrganizationMembership`. The signed `organization_membership.updated` webhook consumes that intent exactly once and supplies the test actor, previous/current roles, and `approved=false` evidence. Use `--actorId=<id>` to override the default `staging-trigger`. Only `admin` is accepted because the policy models an unauthorized elevation, not a demotion. Directory/IdP-managed memberships may reject or later overwrite direct API role changes.

These staging commands do not use fixture payloads. Country and privilege actions use WorkOS’s official APIs and signed webhooks. Device login combines the official WorkOS authentication/session with the template’s explicit first-party Ed25519 provider because WorkOS does not claim to attest the device. Production rejects all scenario triggers.

The most useful trigger inputs are:

| Variable                                                         | Used by       | Resolution                                                                  |
| ---------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------- |
| `ALERT_WEBHOOK_URL`                                              | all           | Optional destination; defaults to `http://localhost:$PORT/webhooks/alerts`. |
| `ALERT_WEBHOOK_SECRET`                                           | delivery only | Shared HMAC secret, minimum 16 characters. It is not required by `--print`. |
| `ALERT_WEBHOOK_SOURCE` / `ALERT_WEBHOOK_SOURCES`                 | all           | Producer name; it must be accepted by Hono’s source allowlist.              |
| `INCIDENT_TENANT_ID`                                             | all           | Local tenant used in the generated alert.                                   |
| `INCIDENT_SUBJECT_ID`                                            | all           | Local subject used in the generated alert.                                  |
| `INCIDENT_ACTOR_ID`, `PREVIOUS_ROLE`, `NEXT_ROLE`                | privilege     | Optional role-change overrides.                                             |
| `INCIDENT_SESSION_ID`, `COUNTRY_LOGIN_IP`                        | country       | Local fixture overrides.                                                    |
| `INCIDENT_SESSION_ID`, `INCIDENT_DEVICE_ID`, `UNKNOWN_DEVICE_IP` | device        | Local fixture overrides.                                                    |

Deliver a fresh local alert while `npm run dev` is running:

```sh
npm run fixture:send -- country
```

The response contains `incidentId`. Open:

```text
http://localhost:3000/dashboard/incidents/<incidentId>
```

## Test WorkOS locally through ngrok

WorkOS must call a public HTTPS URL; `localhost` is not reachable from WorkOS. ngrok only exposes the Hono port `3000`—Studio on `4111` does not need a tunnel.

1. Install ngrok, authenticate the agent, and start the application:

   ```sh
   ngrok config add-authtoken <your-ngrok-authtoken>
   npm run dev:server
   ```

2. In another terminal, expose Hono:

   ```sh
   ngrok http 3000
   ```

3. Copy the HTTPS forwarding URL, for example `https://example.ngrok-free.app`, and register this exact endpoint in the WorkOS **staging** environment:

   ```text
   https://example.ngrok-free.app/webhooks/workos
   ```

4. Subscribe only to:

   ```text
   organization_membership.updated
   session.created
   session.revoked
   ```

5. Copy the signing secret generated for that endpoint into `.env` as `WORKOS_WEBHOOK_SECRET`. This is not the WorkOS API key or Client ID. Configure the staging organization and allowed role slugs, enable the provider, and restart `npm run dev:server`:

   ```dotenv
   RUNTIME_MODE=staging
   WEBHOOKS_ENABLED=true
   WORKOS_PROVIDER_ENABLED=true
   WORKOS_API_KEY=<staging-api-key>
   WORKOS_WEBHOOK_SECRET=<ngrok-endpoint-signing-secret>
   WORKOS_ORGANIZATION_ID=<staging-organization-id>
   WORKOS_ALLOWED_ROLE_SLUGS=member,admin
   IPINFO_PROVIDER_ENABLED=true
   IPINFO_TOKEN=<ipinfo-lite-token>
   GEOIP_CACHE_HMAC_KEY=base64:<32-byte-key-material>
   GEOIP_CACHE_HMAC_KEY_VERSION=hmac-sha256-v1
   DASHBOARD_AUTH_ENABLED=true
   WORKOS_CLIENT_ID=<staging-client-id>
   WORKOS_REDIRECT_URI=http://localhost:3000/auth/callback
   WORKOS_COOKIE_PASSWORD=<application-secret>
   DASHBOARD_CSRF_SECRET=<application-secret>
   APPROVAL_RESUME_SECRET=<application-secret>
   ```

6. On the WorkOS webhook endpoint detail page, use **Send test event**. A `2xx` response confirms the public tunnel and signature path. WorkOS sample IDs normally do not match your allowlists, so a body with `disposition: "dead_lettered"` and `WORKOS_ALLOWLIST_REJECTED` is expected for a synthetic sample; it does not prove the complete workflow.

7. Verify the actual WorkOS login first. You can run `npm run trigger:country` and open the printed `loginUrl`, or open `http://localhost:3000/dashboard` and select **Sign in**. Complete the AuthKit flow with a staging operator that has exactly one approved SOC role. The callback must return to the authenticated dashboard.

8. For a real end-to-end staging test, perform a controlled action on a staging identity in the configured organization:

   - create/sign in to a real session to emit `session.created`; or
   - run `trigger:privilege -- --userId=<id> --role=admin --execute`; the command captures the official baseline before the update.

   Keep the ngrok inspector at `http://127.0.0.1:4040` open to see the request, `WorkOS-Signature`, response status, and response body. Do not copy signatures or secrets into tickets or recordings.

9. Copy `incidentId` from the webhook response or locate the newest incident in the dashboard. Verify the timeline shows intake, outbox dispatch, workflow start, and provider branches.

Free ngrok URLs can change when the tunnel restarts. Update the WorkOS endpoint whenever that happens. A reserved domain avoids this churn. The official guides cover [ngrok agent commands](https://ngrok.com/docs/agent/cli) and [WorkOS webhook registration, verification, and test events](https://workos.com/docs/events/data-syncing/webhooks).

## Review and decide

Review the evidence, missing-data markers, runbook citations, severity, summary, and exact action plan. Approval resumes the suspended run; rejection completes it without containment. In either case, the timeline records the authority, decision, provider attempt, and verification outcome.

If an incident stops before `await-approval`, inspect the workflow output and branch errors. `manual-review` means required proof was absent; `blocked` means a deterministic integrity or action guard failed; a provider error reports its stable code and retryability without leaking the raw response.

## Extend the workflow

Do not create a second workflow for every signal. Normalize the provider event into the alert contract, add the required evidence adapter, and publish or update the applicable runbook. Add evaluation cases for classification, attribution, runbook compliance, and containment safety before enabling the alert source.
