# Phase 3 — Connection Pass-Through + Per-Agent Pin

> Parent RFC: [`../composio-research.md`](../composio-research.md) — see "DISCOVERY (rev 3)".
> Previous phase: [Phase 2 — Gated Catalog View](./phase-2-catalog.md)
> Next phase: [Phase 4 — Builder UI](./phase-4-builder-ui.md)

> **Rev 5 — drop the DB table**:
>
> Earlier revisions of this phase planned a `ComposioConnection` table mirroring every Composio `ConnectedAccount`. That table is now deferred. Composio is the source of truth for connection records; storing them locally is duplicate state with no benefit for v1 platform-auth or even the vNext per-user / per-author modes (those only change which `userId` we pass, which Composio already scopes by).
>
> A local table only makes sense once Mastra needs metadata Composio does not natively model — connection-level RBAC, Mastra-side labels, audit history, or multi-workspace sharing. None of those land in v1. They're reserved as vNext work in the parent RFC.
>
> What stays in this phase:
> 1. **The pin** — `connectionsByToolkit?: Record<toolkitSlug, connectedAccountId>` on the agent's existing `integrationTools.composio` slot. This is per-agent config, not a credential.
> 2. **Pass-through server routes** — list / initiate / revoke against `@composio/core`, gated by `registries.composio` and the `composio:read` / `composio:write` permissions.
> 3. **The user-id resolver** — `resolveComposioUserId()` returns `registry.platformUserId` for v1; vNext adds the per-user and per-author branches.

## Goal

Let an admin (or author with `composio:write`) connect a Composio account through a Connect Link round-trip, surface the resulting `connectedAccountId` to the Builder UI, and persist the per-agent pin so a created agent can target the right account at runtime. No new tables — Composio holds the connection record, the agent's `integrationTools` map holds the pin.

## Background

- **Why this phase is ordered here**: Phase 4 (Builder UI) needs `list` + `initiate` endpoints before authors can pick or create an account; Phase 5 (Runtime) needs the pin in storage before it can build `accountSelection`. Phase 3 ships both without coupling the UI to the runtime.
- Parent RFC sections to re-read:
  - "USER IDS — same or different across phases" — v1 hardcodes `registry.platformUserId`.
  - "MULTI-ACCOUNT PER TOOLKIT" — `allowMultiple` plus per-agent pin is how two agents share a toolkit but target different accounts.
  - "PER-AGENT AUTH MODE (vNext)" — schema reserves `composioAuthMode` but never writes it in v1.
- Inherited blockers: registry config (Phase 1), gated catalog (Phase 2) — every server route validates the requested `toolkit` against `registry.allowedToolkits` before any `@composio/core` call.

## Scope

### Storage (minimal)
- `packages/core/src/storage/types.ts` — extend `StorageMCPClientToolsConfig` with `connectionsByToolkit?: Record<string, string>` (toolkit slug → `connectedAccountId`). One pin per toolkit covers every tool the agent uses from that toolkit. Round-trips through save / load like any other field on `integrationTools.<providerId>`.
- `packages/core/src/tool-provider/types.ts` — extend `ResolveToolProviderToolsOptions` with `connectionsByToolkit?: Record<string, string>`. Optional; non-Composio providers ignore it. This is the wire format `resolveTools` will consume in Phase 5.
- `packages/editor/src/namespaces/agent.ts` (`resolveStoredIntegrationTools`) — pull `providerConfig.connectionsByToolkit` off the stored config and forward it to `provider.resolveTools(slugs, configs, { requestContext, connectionsByToolkit })`. Pure pass-through; provider still ignores the field this phase.

**Explicitly NOT in scope**: any new storage domain, table, or migration. No `ComposioConnection` repository.

### Editor module (connection helpers, thin)

**Client reuse**: `ComposioToolProvider` already holds a `Composio` client built from `apiKey`. Expose it via a new public accessor `getRawClient(): Composio` (rename of the existing private method). The connections helpers receive the provider instance and call `provider.getRawClient()` — no second SDK instantiation, no separate API key plumbing.

**Helper signatures** — every helper takes a single context object `{ provider: ComposioToolProvider; registry: ResolvedComposioRegistry }` derived once per request (Phase 2's `resolveComposioContext` already returns both):

- `initiateConnection(ctx, { toolkit, allowMultiple? })`:
  1. Assert `toolkit ∈ registry.allowedToolkits`, else throw `ToolkitNotAllowedError`.
  2. Resolve `authConfigId` via `resolveAuthConfigId(ctx, toolkit)`:
     - If `registry.authConfigs?.[toolkit]` is set, use it (explicit pin, escape hatch).
     - Otherwise call `composio.authConfigs.list({ toolkit })` and pick the single enabled item.
     - Throw `ComposioAuthConfigMissingError` when zero enabled configs exist (admin must create one in Composio dashboard).
     - When more than one enabled config exists, tie-break by preferring `isComposioManaged === true` (admin-curated custom configs aren't auto-picked).
     - Throw `ComposioAuthConfigAmbiguousError` when the tie-break still leaves multiple candidates (admin must pin one explicitly).
  3. `userId = resolveComposioUserId(ctx)`.
  4. Call `ctx.provider.getRawClient().connectedAccounts.initiate(userId, authConfigId, { allowMultiple })`.
  5. Return Composio's `{ id, redirectUrl, status }` straight through (`ConnectionRequestState`).
- `getConnection(ctx, id)` → `client.connectedAccounts.get(id)`. No toolkit check (id-scoped); caller may inspect `response.toolkit.slug` against the allowlist if needed.
- `listConnections(ctx, { toolkit? })`:
  1. If `toolkit`, assert in `allowedToolkits`.
  2. `client.connectedAccounts.list({ userIds: [resolveComposioUserId(ctx)], toolkitSlugs: toolkit ? [toolkit] : undefined })`.
  3. Return Composio's response unmodified.
- `revokeConnection(ctx, id)` → `client.connectedAccounts.disable(id)`.

> SDK signatures verified against installed `@composio/core` types:
> - `initiate(userId: string, authConfigId: string, options?: { allowMultiple?: boolean; callbackUrl?: string; config?: ConnectionData })` → `ConnectionRequest extends { id; status?; redirectUrl? | null }`.
> - `list(query?: { userIds?: string[]; toolkitSlugs?: string[]; statuses?: ConnectedAccountStatus[]; ... })` — **plural** `userIds` / `toolkitSlugs`.
> - `get(nanoid: string)`, `disable(nanoid: string)`.

- `packages/editor/src/ee/integrations/composio/user-id.ts` — `resolveComposioUserId(ctx)`. v1 returns `ctx.registry.platformUserId`. Phase 5 imports it verbatim; vNext extends the function body.

### Boot-time managed-config provisioning (dev UX)

When `registries.composio.autoProvisionManagedConfigs === true`, `MastraEditor.resolveBuilder()` runs `provisionManagedAuthConfigs({ registry, client })` after constructing `EditorAgentBuilder`:

- For each `allowedToolkits` entry **without** an explicit `authConfigs` pin:
  1. Call `composio.authConfigs.list({ toolkit })`.
  2. If any active configs exist, skip (auto-discovery will resolve them at initiate-time).
  3. Otherwise call `composio.authConfigs.create(toolkit, { type: 'use_composio_managed_auth' })` and log a warning so admins know a managed config was created.
- Failures are logged but never crash boot — Connect Link still falls back to `ComposioAuthConfigMissingError` at initiate-time.
- Idempotent: subsequent restarts discover the previously-created config in step 2.

Recommended for dev / staging. For production, pin custom configs explicitly via `authConfigs` and leave `autoProvisionManagedConfigs` unset (defaults to `false`).

### Server
- `packages/server/src/server/handlers/editor-builder-composio.ts` — add four routes, all gated by Phase 2's `resolveComposioContext`:
  - `POST /editor/builder/composio/connections` — initiate. Body: `{ toolkit, allowMultiple? }`. Permission: `composio:write`.
  - `GET /editor/builder/composio/connections` — list. Query: `toolkit?`. Permission: `composio:read`.
  - `GET /editor/builder/composio/connections/:id` — single read (status poll). Permission: `composio:read`.
  - `DELETE /editor/builder/composio/connections/:id` — revoke. Permission: `composio:write`.
- Regenerate `packages/core/src/auth/ee/interfaces/permissions.generated.ts` to pick up `composio:write`.

**Explicitly NOT in scope**:
- Callback / webhook route — Composio's hosted Connect Link handles the OAuth round-trip in its own UI. Phase 4 polls `GET /:id` until status flips to `ACTIVE`.
- Per-agent `composioAuthMode` enforcement — field reserved on the agent storage type but never written.

### Tests
- `packages/editor/src/ee/integrations/composio/connections.test.ts` — mocked Composio client: each helper passes `platformUserId`, rejects toolkits outside `allowedToolkits`, forwards `allowMultiple`.
- `packages/editor/src/ee/integrations/composio/user-id.test.ts` — returns `platformUserId`; throws if registry disabled.
- `packages/editor/src/namespaces/agent.test.ts` — extend with a case asserting `connectionsByToolkit` round-trips through `resolveStoredIntegrationTools` to a fake provider.
- `packages/server/src/server/handlers/editor-builder-composio.test.ts` — extend existing file: 4 new routes, 404 when builder disabled, 403 without the right permission, happy-path mocks calling into the stubbed editor module.

## Acceptance truths

- [ ] `StorageMCPClientToolsConfig.connectionsByToolkit?` exists in `@mastra/core/storage` types and round-trips through agent save/load.
- [ ] `ResolveToolProviderToolsOptions.connectionsByToolkit?` exists in `@mastra/core/tool-provider`; `ComposioToolProvider.resolveTools` signature still satisfies the interface (field ignored this phase).
- [ ] `EditorAgentNamespace.resolveStoredIntegrationTools` forwards `connectionsByToolkit` to `provider.resolveTools`; unit-tested against a fake provider.
- [ ] `resolveComposioUserId()` returns `registry.platformUserId` and is the **only** function that reads that field outside Phase 1's validation.
- [ ] All four connection routes 404 when the editor / builder / `registries.composio` is disabled (reuses Phase 2's `resolveComposioContext`).
- [ ] `POST /composio/connections` returns Composio's `{ id, redirectUrl }` verbatim; never persists a Mastra-side row.
- [ ] `GET /composio/connections?toolkit=gmail` returns Composio's response unmodified, scoped to `platformUserId` server-side.
- [ ] `DELETE /composio/connections/:id` calls `composio.connectedAccounts.disable(id)`.
- [ ] `composio:write` permission is added and grants initiate/revoke; `composio:read` covers list/get.
- [ ] No call site reads `userId` from request body — every helper derives it via `resolveComposioUserId()`.
- [ ] No new storage domain, table, or migration is introduced.

## Verification step

```
pnpm build:core
pnpm --filter ./packages/core check
pnpm --filter ./packages/core test -- composio
pnpm --filter ./packages/editor build && pnpm --filter ./packages/editor test -- composio
pnpm --filter ./packages/server build && pnpm --filter ./packages/server test -- editor-builder-composio
pnpm --filter ./packages/server generate:permissions
```

All must pass. Manual smoke against `examples/agent-builder`:

```js
// POST initiate, copy redirectUrl, complete OAuth in browser
await api('/editor/builder/composio/connections', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ toolkit: 'gmail' }),
})

// poll until status flips to ACTIVE
await api('/editor/builder/composio/connections/<id>')

// confirm it shows up scoped to the platform user
await api('/editor/builder/composio/connections?toolkit=gmail')

// revoke
await api('/editor/builder/composio/connections/<id>', { method: 'DELETE' })
```

## Handoff to next phase

- Canonical user-id resolver: `resolveComposioUserId()` in `packages/editor/src/ee/integrations/composio/user-id.ts`. **Phase 5 imports this verbatim** — do not duplicate.
- Connection helpers (`initiateConnection`, `getConnection`, `listConnections`, `revokeConnection`) are the only public surface. Phase 4 UI hooks call them via the server routes; client code never imports `@composio/core` directly.
- The pin plumbing (`connectionsByToolkit` on storage + on `ResolveToolProviderToolsOptions`) is wired but inert: it travels from agent storage through `resolveTools` and is ignored by `ComposioToolProvider`. Phase 5 turns it on by translating it into Composio session `accountSelection`.
- Phase 4 writes `connectionsByToolkit[toolkit] = connectedAccountId` when an author picks an account in the toolkit picker. No other writer of that field exists.
- Reserved schema field `composioAuthMode?` on the agent record stays nullable in v1. vNext modes flip it.
- Follow-up backlog (deferred):
  - `ComposioConnection` table — only when Mastra-side metadata (labels, ACL, audit) becomes necessary.
  - Webhook callback for OAuth completion — currently polling-based.
  - Revocation cascade to dependent agents — currently surfaced as a runtime `ComposioConnectionRevokedError` in Phase 5/6.
