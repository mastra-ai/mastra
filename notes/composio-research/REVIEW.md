# Composio Integration — Review Doc

> Read this first. Then read individual phase docs only if you need the why-we-did-this-way background.
> Parent RFC: [`../composio-research.md`](../composio-research.md)
> Phase docs: [`./README.md`](./README.md)

This document is the single-shot orientation for a coworker stepping onto the Composio integration. It explains **what shipped**, **how the pieces talk to each other**, **where the seams are**, and **what to test manually**.

---

## TL;DR

- Builder agents can now author with **Composio toolkits** end-to-end: pick toolkit → connect account → pick tools → run agent.
- v1 ships with **5 of 6 phases done**. Phase 6 (ops polish) is partially done — health helper + UI status pill landed; full error buffer + infra endpoint + docs are still open.
- Storage is **Composio-source-of-truth** for connections. We store **pins** (`connectionsByToolkit: Record<toolkit, ConnectionPin[]>`), not connection state.
- Auth is **platform mode** in v1: a single `platformUserId` owns all connections. Per-user / per-author auth is reserved for vNext (`resolveComposioUserId` is the seam).
- Tools live in the **unified Tools picker** (no dedicated Integrations panel anymore).
- Multi-account pinning is supported: 2 Gmail accounts on one agent become `GMAIL_SEND_EMAIL__WORK` + `GMAIL_SEND_EMAIL__PERSONAL` at runtime with per-call `connectedAccountId` injection.

---

## Phase status

| Phase | What it ships | Status |
|-------|----------------|--------|
| 1 | Registry config + validation (`editor.builder.registries.composio`) | ✅ |
| 2 | Gated catalog routes (`/composio/toolkits`, `/toolkits/:slug/tools`) | ✅ |
| 3 | Connection lifecycle routes + auth-config auto-discovery / provisioning | ✅ |
| 4 | Builder UI: unified Tools picker with Composio rows + Connect Link modal | ✅ |
| 5 | Runtime tool execution + multi-account pinning | ✅ |
| 6 | Ops polish (health helper + UI pill landed; error buffer + docs open) | 🟡 partial |

---

## 1. Configuration (where admins turn it on)

**File**: `examples/agent-builder/src/mastra/index.ts` — example wiring.

```ts
new Mastra({
  editor: {
    builder: {
      registries: {
        composio: {
          apiKey: process.env.COMPOSIO_API_KEY,
          platformUserId: 'platform',              // single-user mode for v1
          allowedToolkits: ['gmail', 'github'],     // allowlist gate (must be non-empty)
          authConfigs: { gmail: 'ac_HN_uDi_5CKBs' },// optional explicit pin per toolkit
          autoProvisionManagedConfigs: true,        // optional: create managed authConfigs at boot if none exist
        },
      },
    },
  },
});
```

- Validated by `validateComposioRegistry` in `packages/editor/src/ee/integrations/composio/validate.ts`.
- Resolved registry exposed via `EditorAgentBuilder.getComposioRegistry()`.
- If `apiKey` is missing or registry is disabled, all `/composio/*` routes return **404** and the UI hides Composio entirely (`useComposioEnabled`).

**Auth-config resolution order** (`resolveAuthConfigId` in `packages/core/src/agent-builder/ee/composio-connections.ts`):

1. Explicit pin in `authConfigs[toolkit]` wins.
2. Otherwise fetch `composio.authConfigs.list({ toolkit })`:
   - **0 active** → `ComposioAuthConfigMissingError` (unless `autoProvisionManagedConfigs: true`, in which case we create a managed config at boot via `maybeProvisionComposioManagedConfigs` in `packages/editor/src/index.ts`).
   - **1 active** → use it.
   - **2+ active** → prefer `isComposioManaged`, else throw `ComposioAuthConfigAmbiguousError` with the offending IDs.

---

## 2. Architecture map

```
                                              EditorAgentBuilder
                                              ├─ resolvedComposioRegistry
                                              │   (apiKey, platformUserId, allowed,
                                              │    authConfigs, autoProvision)
                                              │
   ┌─────────────────────────────────────────┘
   │
   ▼
ComposioToolProvider  ──── Composio SDK ──── Composio Cloud
   ▲                       (@composio/core
   │                        + @composio/mastra)
   │ resolveTools(options)
   │
   │ ┌────────────────────────────┐
   │ │ EditorAgentBuilder.agent   │   ──── /api/agents/<id>          (Mastra runtime; tool execution)
   │ │   ↳ listTools / runTool    │   ──── /api/editor/builder/...   (catalog + connection routes)
   │ └────────────────────────────┘
   │
   ▼
StoredAgent.mcpClientToolsConfig
   ├─ tools          (tool selection per provider)
   └─ connectionsByToolkit: Record<toolkit, ConnectionPin[]>   ← the "pins"
```

Key invariant: **only pins are stored**. Connection objects (`ca_xxx`, status, expiry) live in Composio. We re-query Composio every time we need them.

---

## 3. Storage shape

**Location**: `packages/core/src/storage/types.ts` (`StorageMCPClientToolsConfig`) — mirrored in `client-sdks/client-js/src/types.ts` and Zod schemas under `packages/server/src/server/schemas/{stored-agents,agent-versions}.ts`.

```ts
type ConnectionPin = { connectedAccountId: string; label?: string };

interface StorageMCPClientToolsConfig {
  tools?: Record<string, EntityConfig>; // existing
  connectionsByToolkit?: Record<string, ConnectionPin[] | string>;
  //                                                       ^^^^^^
  //                                  legacy single-string tolerated on read
}
```

- Read path normalizes via `normalizeConnectionPins` (`packages/core/src/agent-builder/ee/composio-connection-pins.ts`).
- Write path always emits `ConnectionPin[]`.

---

## 4. Server routes

All gated by `composio:read` or `composio:write`. Defined in `packages/server/src/server/handlers/editor-builder-composio.ts` and registered in `server-adapter/routes/editor-builder.ts`. Return 404 when the registry is disabled.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/editor/builder/composio/toolkits` | List toolkits filtered by `allowedToolkits` |
| GET | `/editor/builder/composio/toolkits/:slug/tools` | List tools for one allowed toolkit |
| GET | `/editor/builder/composio/connections` | List connected accounts for `platformUserId` |
| POST | `/editor/builder/composio/connections` | Initiate OAuth (`composio.connectedAccounts.initiate`) |
| GET | `/editor/builder/composio/connections/:id` | Fetch a connection |
| DELETE | `/editor/builder/composio/connections/:id` | Revoke a connection |
| GET | `/editor/builder/composio/health` | **Diagnostic** — per-toolkit auth source + active account count |

---

## 5. Builder UI (where authors do work)

Entry: `/agent-builder/agents/create` in the example app.

### Tools picker (unified)
**File**: `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/tools-detail.tsx`

- Single flat list. Native tools and Composio tools render with the same checkbox row.
- Each Composio tool row also shows an `AccountPicker` once a connection exists (multi-select; inline label edit).
- Toggling a Composio tool ON auto-pins the first active account if exactly one exists.
- Toggling OFF or unpinning every account removes the toolkit from `connectionsByToolkit`.

### Connect Link modal
**Files**: `packages/playground/src/domains/composio/components/connect-link-modal.tsx`, `hooks/use-composio-connect-bridge.tsx`.
- Bridge component opens a window/iframe to Composio's redirect URL.
- After OAuth completes, React Query invalidates `composio-connections` and the new `ca_xxx` appears in the picker.

### Composio Health Pill (new)
**File**: `packages/playground/src/domains/composio/components/composio-health-pill.tsx`.
- Mounts in the Tools row header. Tones: green = all ok, amber = some failing, red = all failing / unreachable.
- Click → popover with per-toolkit `authConfigId`, source (`pinned`/`auto`), connected-account count, or error.
- Refresh button forces a re-probe.

### chat-driven `agentBuilderTool`
**File**: `packages/playground/src/domains/agent-builder/components/agent-builder-edit/hooks/use-agent-builder-tool.ts`.
- Has a `composio` field on its input schema so the LLM can edit Composio tools/connections through the chat just like it edits other agent fields.
- Side-effect tool `connectComposioTool` opens the same Connect Link bridge when the LLM asks the user to authorize an account.

---

## 6. Runtime (where tool execution happens)

**File**: `packages/editor/src/providers/composio.ts`

`ComposioToolProvider.resolveTools(toolIds, options)` is called by the editor agent for every invocation.

Flow:

1. **Bail-outs**: empty `toolIds`, or registry disabled, or unknown toolkit → return `{}`.
2. **Group by toolkit** from the slug prefix (e.g. `GMAIL_SEND_EMAIL` → `gmail`).
3. **Resolve `userId`** via `resolveComposioUserId({ registry })` — currently `platformUserId`. This is the seam for vNext per-user mode.
4. **Fan out per pin** in `connectionsByToolkit[toolkit]`:
   - 0 pins → one `composio.tools.get(userId, { tools })` call, no account binding.
   - 1 pin → one call with `beforeExecute` modifier injecting `connectedAccountId`. Tool name kept original.
   - 2+ pins → one call **per pin**, with renamed tools `<SLUG>__<LABEL_OR_ACCT_SUFFIX>` and `[Routed to <label>]` appended to description.
5. **Strip `outputSchema`** on every returned `Tool` instance. (`@composio/mastra@0.6.5` declares `error: string` but the SDK returns `error: null` on success → would fail validation.)
6. **Error mapping**: SDK errors mentioning revoked/expired surfaced as `ComposioConnectionRevokedError` so the UI can prompt re-connect.

> ⚠ Why not `composio.create()` (session API)? We tried. It returns "meta-tools" via `wrapToolsForToolRouter` whose schemas Mastra's runtime doesn't understand. Reverted to `tools.get + beforeExecute` modifier. Upstream `@composio/mastra` fix is the proper long-term solution.

---

## 7. Health helper (Phase 6 partial)

**File**: `packages/core/src/agent-builder/ee/composio-health.ts`

```ts
getComposioHealth({ registry, client }): Promise<{
  status: 'ok' | 'error';
  enabled: boolean;
  platformUserId: string;
  toolkits: Array<{
    toolkit: string;
    status: 'ok' | 'error';
    authConfigId: string | null;
    authConfigSource: 'pinned' | 'auto' | null;
    connectedAccounts: number;
    error?: string;
    errorCode?: 'ComposioAuthConfigMissingError' | 'ComposioAuthConfigAmbiguousError' | 'Unknown';
  }>;
}>
```

- Probes each allowed toolkit without running an agent.
- Per-toolkit failures captured in-line; the route never 500s on a single drift.
- Wired to `GET /editor/builder/composio/health` and surfaced by the Composio status pill in the builder UI.

---

## 8. Manual test plan

Prereqs: `COMPOSIO_API_KEY` set, registry enabled in `examples/agent-builder/src/mastra/index.ts`, at least one ACTIVE Gmail connection for user `platform`.

### Happy path
1. `pnpm --filter examples/agent-builder dev`.
2. Open `/agent-builder/agents/create`.
3. **Health pill** in Tools row should be **green** and list each allowed toolkit with `connectedAccounts > 0` for gmail.
4. Open Tools → find a Gmail tool → check the box.
   - Auto-pin should populate the AccountPicker with the only active account.
5. Save / autosave → in devtools:
   ```js
   fetch('/api/stored/agents/<id>').then(r => r.json()).then(a => console.log(a.mcpClientToolsConfig));
   ```
   Expect: `{ tools: { 'composio:GMAIL_SEND_EMAIL': {} }, connectionsByToolkit: { gmail: [{ connectedAccountId: 'ca_...', label?: '...' }] } }`.
6. Run the agent: "Send a test email to me@example.com saying hi". Email should arrive from the pinned Gmail account.

### Multi-account
1. In Composio dashboard, connect a **second** Gmail account for user `platform`.
2. Refresh the AccountPicker → multi-select. Tick both, optionally rename labels (`work`, `personal`).
3. Save. Stored agent should now have `connectionsByToolkit: { gmail: [{ connectedAccountId: 'ca_1', label: 'work' }, { connectedAccountId: 'ca_2', label: 'personal' }] }`.
4. `fetch('/api/agents/<id>').then(r => r.json())` — expect tools `GMAIL_SEND_EMAIL__WORK` and `GMAIL_SEND_EMAIL__PERSONAL`.
5. Run the agent with "Send from my work account…" and "Send from my personal account…". Verify the right sender.

### Health failure paths
- Delete all gmail authConfigs in the Composio dashboard → pill turns **amber/red**, popover shows `ComposioAuthConfigMissingError` for gmail.
- Create a second active gmail authConfig and remove the explicit pin → expect `ComposioAuthConfigAmbiguousError`.
- Set `enabled: false` (remove `apiKey`) → route 404s, pill hidden (along with the rest of Composio UI).

### Revoked connection
1. With an agent that uses Gmail, revoke its connection in the Composio dashboard.
2. Run the agent → expect `ComposioConnectionRevokedError` surfaced.

---

## 9. Known limitations / open items

- **`@composio/mastra` output schema mismatch** — we strip `outputSchema` per-tool as a workaround. Upstream fix needed.
- **No session API** — multi-account routing uses per-call `connectedAccountId` injection via a `beforeExecute` modifier rather than Composio's ToolRouter session.
- **Phase 6 remaining**:
  - In-memory error ring buffer (`recordComposioError`) + `lastError`/`lastErrorAt` on health response.
  - `GET /editor/builder/infrastructure` Composio block (`configured`, `activeConnections`, `pendingConnections`, `lastError`).
  - User-facing error mapping in `composio-errors.ts` (revoked / rate-limit / not-allowed).
  - `connection-status-badge.tsx` on AccountPicker rows.
  - Docs: `docs/src/content/en/docs/editor/composio.mdx` + reference page.
- **Auth modes**: only `platform` mode in v1. `resolveComposioUserId` is the seam for `per-author` / `per-user` modes (vNext).
- **Connection-level RBAC**: deferred.
- **E2E Playwright** for chat-driven Composio flow: deferred.

---

## 10. File index (quick jump table)

| What | Where |
|------|-------|
| Registry types | `packages/core/src/agent-builder/ee/types.ts` |
| Registry validation | `packages/editor/src/ee/integrations/composio/validate.ts` |
| ConnectionPin shape + normalize | `packages/core/src/agent-builder/ee/composio-connection-pins.ts` |
| Auth-config resolution | `packages/core/src/agent-builder/ee/composio-connections.ts` |
| User-id resolution (vNext seam) | `packages/core/src/agent-builder/ee/composio-user-id.ts` |
| Health helper | `packages/core/src/agent-builder/ee/composio-health.ts` |
| Tool provider (runtime) | `packages/editor/src/providers/composio.ts` |
| Provisioner (boot-time) | `packages/editor/src/composio.ts` |
| Server handlers | `packages/server/src/server/handlers/editor-builder-composio.ts` |
| Route registration | `packages/server/src/server/server-adapter/routes/editor-builder.ts` |
| Unified Tools picker | `packages/playground/src/domains/agent-builder/components/agent-builder-edit/details/tools-detail.tsx` |
| Account picker | `packages/playground/src/domains/composio/components/account-picker.tsx` |
| Connect Link bridge | `packages/playground/src/domains/composio/components/connect-link-modal.tsx` |
| Health pill (UI) | `packages/playground/src/domains/composio/components/composio-health-pill.tsx` |
| Catalog hooks | `packages/playground/src/domains/composio/hooks/use-composio-catalog.ts` |
| Connections hooks | `packages/playground/src/domains/composio/hooks/use-composio-connections.ts` |
| Health hook | `packages/playground/src/domains/composio/hooks/use-composio-health.ts` |
| `agentBuilderTool` (chat) | `packages/playground/src/domains/agent-builder/components/agent-builder-edit/hooks/use-agent-builder-tool.ts` |
| Form schema | `packages/playground/src/domains/agent-builder/schemas.ts` |
| Form ↔ API mappers | `packages/playground/src/domains/agents/utils/agent-form-mappers.ts`, `packages/playground/src/domains/agent-builder/mappers/*` |
| Server Zod schemas | `packages/server/src/server/schemas/{stored-agents,agent-versions}.ts` |

---

## 11. Tests touched / added

- `packages/core/src/agent-builder/ee/composio-health.test.ts` (5 tests) — health helper
- `packages/core/src/agent-builder/ee/composio-connection-pins.test.ts` (10 tests) — normalization
- `packages/editor/src/providers/composio.test.ts` (14 tests) — runtime fan-out, suffix naming, legacy normalization, revoked-pin detection
- `packages/server/src/server/handlers/editor-builder-composio.test.ts` (25 tests) — catalog + connections + health routes
- Mapper tests under `packages/playground/src/domains/agent-builder/mappers/__tests__/` updated for `ConnectionPin[]`

Pre-existing failures unrelated to this work: 3 in `agent-builder-sidebar.test.tsx` (QueryClient setup).

---

## 12. Glossary

- **Toolkit** — A Composio integration (e.g. `gmail`, `github`). Has many tools.
- **Tool** — A single action (e.g. `GMAIL_SEND_EMAIL`). Slug is `<TOOLKIT_UPPER>_<ACTION_UPPER>`.
- **AuthConfig** (`ac_xxx`) — Composio's stored OAuth credentials for a toolkit. One toolkit can have many; we pick one via `resolveAuthConfigId`.
- **Connected Account** (`ca_xxx`) — A specific user's authorized connection for a (toolkit, authConfig) pair.
- **Pin** — `(connectedAccountId, label?)` stored on the agent. Tells the runtime which account(s) to route through.
- **`platformUserId`** — The Composio user ID we currently use for all connections. Future per-user mode will swap this per request via `resolveComposioUserId`.
