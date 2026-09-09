# Security & Compliance — Mastra Software Factory

## Auth boundary

Every route resolves the caller through one seam: `RouteAuth` (`src/auth.ts`), built from whatever `IMastraAuthProvider` the host configures — default `MastraAuthStudio` (proxies to the shared Mastra platform API), or `null` to run with auth disabled (open server; local-dev only, never for a real deployment). Org scope (`org_id`) for every storage read/write is derived from the authenticated caller server-side — never taken from client-supplied input — which is what makes every domain's tenancy (`org_id`-first, see `data-model.md`) actually enforce isolation rather than merely label rows.

## Secrets at rest

`secret-encryption.ts` provides envelope encryption (`SecretEnvelopeV1`) for persisted model credentials, custom-provider API keys, integration connections, and integration settings. `secretEncryption` is **strongly recommended whenever auth is enabled**; omitting it falls back to an explicit plaintext implementation (`createPlaintextFactorySecretEncryption`) with a boot-time warning — acceptable for local dev, not for a real deployment holding real provider credentials.

## OAuth state signing

`state-signing.ts` provides one `StateSigner` per boot (`createStateSigner`) so every integration's OAuth flow signs and verifies `state` with the same secret, preventing a forged callback from one integration being replayed against another. `stateSecret` is optional but defaults to a per-process random secret; integrations that declare `requiresStableStateSigner` reject that default outright (a random per-process secret breaks OAuth across a restart or a multi-process deployment) — a stable `stateSecret` must be configured for those.

## Human-approval gates as a security control

Several business rules exist specifically to prevent an untrusted or unreviewed change from executing unattended (see `business-rules.md` #1–6):

- **Externally-authored items fail closed.** `externallyAuthored()`/`knownExternalAuthor()` require an explicit `authorTrusted`/`factoryAuthored` stamp before treating an external contributor's issue/PR as safe for an agent to act on without a human transition; a missing trust stamp is treated as untrusted, not trusted-by-default.
- **Non-bug items require a human transition or acceptance** before Planning/Execute proceed unattended (Work's `transitionPolicy`).
- **`needsApproval` labels hold a card at rest** until a human clears them or the item is accepted.
- Project-level `autoRunEnabled`/`autoApprovePlans` switches widen autonomy deliberately and are off by default (`FACTORY_PROJECTS_SCHEMA`: both `default: false`) — an operator must opt in, autonomy is never the out-of-the-box behavior.

## Audit trail

`audit_events` (`storage/domains/audit/base.ts`) is append-only — no update/delete API — and is the local source of truth even when an optional WorkOS Audit Logs export mirror is unavailable. Agent-driven actions are distinguished (`actor_type = 'agent'`, `actor_id = 'agent:<threadId>'`) and always chain back to the human who started the run via `metadata.startedBy`, so "an agent did X" is never dead-ended — it traces to the person whose message triggered it. Rule evaluations separately carry a `causalChain` (capped at `MAX_FACTORY_RULE_CAUSAL_DEPTH`) tracing a decision back through the ingress events that produced it, and are idempotent per `ingress` identity so a replayed webhook delivery cannot double-record or double-act.

## GitHub/Linear integration credential handling

Per `integrations/base.ts`'s design: integration credentials are read once by the host's deploy entry and passed explicitly into the integration's constructor — no system code, factory or otherwise, reads an integration's env vars or imports its free functions. This keeps a credential's blast radius to the one construction site and makes an absent integration a safe no-op rather than a code path that might read a stale or wrong env value.

## Provenance, not access control

`configVersion` is stamped everywhere a decision or session kickoff is recorded, but is descriptive provenance only — it never gates access or changes which rule fires. Do not rely on it (or add logic that relies on it) as a security boundary; it exists so an operator can correlate a row with the deployed code that produced it, e.g. during an incident review.

## Telemetry and data minimization

Authenticated Factory web usage telemetry records account/project/deployment/region attribution (`activity`, `page`, `platform_user_id`, `platform_org_id`, `platform_project_id`, `platform_hosted`, `deployment_id`, `platform_region`, `schema_version`) — it can be disabled per deployment via `MASTRA_TELEMETRY_DISABLED=true`. Treat this as the boundary for what's collected outside of the deployment's own database; nothing else beyond these declared properties should be added to the telemetry payload without an explicit product decision.

## Reporting a concern

Follow the root Mastra repository's standard security disclosure process; there is no Factory-specific reporting channel beyond the main project's.
