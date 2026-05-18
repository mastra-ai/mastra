# Composio Integration — Old vs New

Comparative analysis of the legacy `ComposioToolProvider` (`ToolProvider` interface) and the new `ComposioToolIntegration` (`ToolIntegration` interface) shipped as part of the v1 Agent Builder integrations work.

> **Status:** Old is now a 134-LOC thin shim delegating to the new class. Both still ship; legacy is `@deprecated` and scheduled for removal in the next coordinated breaking-change release of `@mastra/editor`.

---

## TL;DR

- **Old** — legacy `ToolProvider` shape: single implicit connection, MCP-style storage, no OAuth UI, caller-scoped runtime bucket.
- **New** — `ToolIntegration` shape: multi-account OAuth, per-author buckets, optional labels, dynamic per-toolkit fields, allowlist filtering, runtime fan-out.
- **Migration cost** — Zero. New `toolIntegrations` field is additive; old `integrationTools` path stays live until removal.

---

## Interface shape

| | Old `ToolProvider` | New `ToolIntegration` |
|---|---|---|
| Location | `packages/core/src/tool-provider/` | `packages/core/src/tool-integration/` |
| Status | `@deprecated`, scheduled removal | Canonical |
| Registry | `MastraEditorConfig.toolProviders: Record<id, ToolProvider>` | `toolIntegrations: ToolIntegration[]` (flat array, ordered) |
| Capabilities | None | `ToolIntegrationCapabilities` (multi-conn, batch status, reauth-reuses-id) |
| Base class | None — implement raw | `BaseToolIntegration` with allowlist filtering |

---

## Discovery API

| | Old | New |
|---|---|---|
| Toolkits | `listToolkits()` → `ToolProviderToolkit[]` | `listToolServices()` → `ToolService[]` (renamed) |
| Tools | `listTools({ toolkit, search, page, perPage })` | `listTools({ toolService, search, page, perPage })` |
| Tool schema | `getToolSchema(slug)` | — (dropped; UI doesn't need it) |
| Allowlist | None — adapter rolls its own | `allowedToolServices` + per-service `allowedTools: Record<string, string[]>` |

---

## Auth / Connections

| | Old | New |
|---|---|---|
| OAuth flow | Not modeled on interface | `authorize({ toolService, connectionId, config })` → `{ url, authId }` |
| Poll status | None | `getAuthStatus(authId)` |
| Custom fields | None (Confluence subdomain returned `400 Missing required fields`) | `listConnectionFields({ toolService })` → dynamic form |
| Existing accounts | None | `listConnections({ toolService, userId })` for pin-without-OAuth |
| Multi-account | Single implicit conn | `connections: Connection[]` per service, with labels |
| Health | None | `getHealth()` + UI pill |
| Revocation check | None | `getConnectionStatus({ items[] })` (batched) |

---

## Storage shape

| | Old (`integrationTools`, MCP-shaped) | New (`toolIntegrations`) |
|---|---|---|
| Shape | `Record<providerId, { tools: string[] }>` | `Record<providerId, { tools: Record<slug, ToolMeta>, connections: Record<service, Connection[]> }>` |
| Per-tool meta | None | `ToolMeta.toolService` + optional description override |
| Connection pinning | Not modeled | First-class, with `kind: 'author' \| 'invoker' \| 'platform'` |
| Labels | N/A | Optional for single conn; required + case-insensitively unique once ≥2 |

Both fields still live on `StorageStoredAgent` — old is not deleted, new is additive.

---

## Runtime resolution

| | Old | New |
|---|---|---|
| Entry | `resolveStoredMCPTools` (in `editor/agent.ts`) | `resolveStoredToolIntegrations` (in `core/tool-integration/runtime.ts`) |
| Signature | `resolveTools(slugs, configs, { userId, requestContext })` | `resolveTools({ toolSlugs, toolMeta, connectionId, authorId, requestContext })` |
| User bucket | `userId` raw or `'default'` | Author-scoped: `authorId` → request context → `'default'` |
| Multi-conn fan-out | N/A | Runtime invokes `resolveTools` once per `Connection` and applies tool-name suffix (`gmail.fetch_emails__WORK`) |
| `connectedAccountId` injection | Implicit (Composio picks single active) | Explicit via `beforeExecute(params.connectedAccountId = connectionId)` |

---

## UI surface

| | Old | New |
|---|---|---|
| Picker | Studio-only catalog + checkbox list | Unified inline picker (native + integration tools in one list) |
| Connections | None | Dedicated `ConnectionsDetail` panel with `ConnectionPicker` per service |
| Connect button | N/A | Inline OAuth + dynamic field form + "Use existing" pin |
| Server routes | `/tool-providers/*` | `/tool-integrations/*` (list, tools, connections, fields, authorize, status, health) |
| Client SDK | `client.toolProvider` (deprecated) | `client.toolIntegration` |

---

## Code footprint

- **Old `ComposioToolProvider`** — 134 LOC. Now a thin translator that forwards every call into the new class.
- **New `ComposioToolIntegration`** — 450 LOC. Owns the actual Composio SDK work.
- Only place the legacy class touches the Composio SDK directly: `getToolSchema` (the one method `ToolIntegration` doesn't expose).

---

## Key behavioral differences

1. **Author bucket vs caller bucket** — Old resolves under the caller's `userId` (breaks when a non-author runs the agent). New resolves under `authorId`, so pins work for any invoker.
2. **Per-service allowlist** — Old has no allowlist. New filters at `BaseToolIntegration` so admins can scope which toolkits/tools surface.
3. **Multiple connections per service** — Old: impossible. New: first-class with label-based LLM disambiguation.
4. **Dynamic fields** — Old: Confluence/Jira-style services with custom fields just failed with `400 Missing required fields`. New: collects them via `listConnectionFields` + inline form.
5. **Storage migration** — None needed. Old `integrationTools` field still hydrates via legacy path; new `toolIntegrations` field runs alongside.

---

## Removal plan

- `ComposioToolProvider`, `ToolProvider`, and `integrationTools` field are all `@deprecated`, scheduled for removal in next coordinated breaking-change release of `@mastra/editor`.
- No runtime cost beyond the shim translation while both exist.

---

## Improvement candidates

### 1. Persist connection labels across agents

**Problem.** Today the label lives on the per-agent pin (`toolIntegrations[providerId].connections[toolService][].label`). When the same author creates a second agent and pulls in an existing Composio connection from the picker, they have no idea which Gmail/Slack/etc. account they're looking at — just an opaque `ca_xxx`. They have to guess and re-label every time.

**Direction.**

- Introduce a new author-scoped `tool_connections` storage table — provider-agnostic, keyed by `(authorId, providerId, toolService, connectionId)`.
- Columns: `label`, `authorId`, `providerId`, `toolService`, `connectionId`, `createdAt`, `updatedAt`.
- Reverse the optional-labels UX for the **first** connection: always show the label input on initial create, since the user is naming the underlying account, not just disambiguating on one agent.
  - Keep the ≥2-per-service uniqueness rule on the per-agent pin layer.
  - Subsequent agents using the same connection inherit the persisted label as a default; user can override per-agent if they want.
- Write path:
  - On `authorize` success or `pin existing`, upsert `tool_connections` row with the user-supplied label.
  - Per-agent pin still carries an optional `label` override (so an agent can rename locally if desired).
- Read path:
  - `listConnections` server route joins `tool_connections` and returns `label` alongside each `connectionId`.
  - Picker shows the persisted label next to existing connections instead of just the raw id.
- Migration: existing pins have agent-local labels. One-time backfill stamps `tool_connections` from any agent's most-recent pin label per `(authorId, connectionId)`. Unlabeled connections stay unlabeled.

**Open follow-ups.**

- Edit/rename UX in the Connections panel (rename here → flows to all agents using this connection) — covered by **#3**.
- Delete UX (revoke connection vs just unpin from one agent) — covered by **#3**.
- Cross-author visibility: out of scope; `tool_connections` is per-author for v1.

- [ ] **#1 — Persist connection labels across agents** (spec above)
- [ ] **#2 — Decide on tool-schema parity** (spec below)
- [ ] **#3 — Connection rename / delete / revoke UX** (spec below)

### 2. Tool-schema parity for the new integration

**Question.** Do we need to bring back `getToolSchema` on `ToolIntegration` so the agent editor / agent builder UI can render a tool's input JSON schema?

**Current state (audited).**

- `getToolSchema` exists on the **legacy** `ToolProvider` interface only.
- Wired through: `composio.ts` shim → server route `GET /tool-providers/:providerId/tools/:toolSlug/schema` → client-js `client.toolProvider.getToolSchema()`.
- **Zero callers in the UI.** `grep` across `packages/playground` and `packages/playground-ui` returns no usage of `getToolSchema`, `tool-providers/.../schema`, or `GetToolProviderToolSchemaResponse`.
- The studio agent editor renders tool input schemas from the **already-resolved** `ToolAction.inputSchema` (i.e. what `agent.listTools()` returns at runtime), not by round-tripping back to the provider catalog for a raw JSON schema.

**Implication.**

- We do **not** need to bring `getToolSchema` over to `ToolIntegration` to unblock the editor UI today.
- The legacy route is dead weight — kept alive only because `ComposioToolProvider` is still exported.

**Decision needed.**

- **Option A — Leave it.** Keep `getToolSchema` on the legacy shim only. New integrations don't expose it. Route stays as a no-op until legacy removal.
- **Option B — Add it to the new interface.** Mirror the legacy method as an optional `getToolSchema?(toolSlug)` on `ToolIntegration`, expose a `/tool-integrations/:id/tools/:slug/schema` route, ship a client method. Future-proofs any feature that wants the raw schema *before* the tool is resolved (e.g. a pre-add preview, a richer catalog page).
- **Option C — Provide it via the catalog descriptor.** Extend `ToolDescriptor` with an optional `inputSchema?: Record<string, unknown>` field; populate it lazily in `listTools` (or via a follow-up `getToolDescriptor(slug)` call). Removes one round-trip vs Option B.

**Recommendation.** Option A for now. Revisit when a UI surface actually wants the pre-resolution schema (e.g. a catalog "View parameters" affordance). If that lands, prefer Option C — fold it into `ToolDescriptor` rather than adding a new method.

---

### 3. Connection rename / delete / revoke UX

**Problem.** Today the picker can:

- Add a connection (OAuth or pin existing) — ✅
- Re-authorize a stale one — ✅ (`handleReauthorize`)
- Edit a connection's label *on this agent* — ✅ (label input)
- Unpin from this agent — ✅ (`handleRemove`)

But the picker **cannot**:

- Rename a connection globally — every agent has its own label
- Delete the underlying Composio connection — only unpin it from the current agent (so it still shows up in `unpinnedExisting` on every other agent, and Composio still holds the OAuth grant)
- Revoke OAuth — same problem; trash icon is misleading
- Tell the user how many other agents are using a connection before they unpin it

This is fine for v1 (one author, a few agents). It breaks down as soon as #1 lands and connections become first-class cross-agent entities.

**Why this is bundled with #1.**

- The `tool_connections` table from #1 is the natural place to hang a `displayName` that's edited once and seen everywhere.
- Once a connection has cross-agent identity, *unpin* and *delete* become genuinely different operations that need separate UI affordances.
- Building this UX without #1 would mean shipping inconsistent label/lifecycle behavior twice.

**Direction (assumes #1 has landed).**

- **Naming.**
  - Three operations on the picker row: **Unpin** (this agent only), **Rename** (global, writes `tool_connections.label`), **Disconnect** (revoke + delete).
  - Per-agent label override stays as an inline `Label override (optional)` input — different from the global `displayName`.
- **Unpin (today's `handleRemove`).**
  - Stays exactly as-is. Just remove from `connections[]` on the form.
  - Tooltip clarifies: "Removes from this agent. The connection stays available for other agents."
- **Rename (new).**
  - Adjacent to label input: pencil affordance → opens a small inline edit row → calls a new server route `PATCH /tool-integrations/:id/connections/:connectionId { label }`.
  - Server upserts the `tool_connections` row.
  - Picker invalidates `useExistingConnections` so the new label propagates immediately to other unpinned rows.
- **Disconnect (new).**
  - Shown only when the connection is *not* pinned to the current agent, OR behind a confirm dialog when it is.
  - New server route `DELETE /tool-integrations/:id/connections/:connectionId` → adapter revokes OAuth (`composio.connectedAccounts.delete`) and we drop the `tool_connections` row.
  - Side effect: any agent still pinning this `connectionId` will fail at runtime. The confirm dialog must surface "Used by N other agents" before allowing this. Requires a usage-count read against `stored_agents.toolIntegrations`.
- **Usage-count read.**
  - Either a derived query on save, or a server route `GET /tool-integrations/:id/connections/:connectionId/usage` that scans stored agents.
  - Initial impl: cheap full scan, fine for our scale. Index later if needed.

**Server-side surface (new).**

- `PATCH /tool-integrations/:id/connections/:connectionId` — body `{ label }`. Writes `tool_connections`. Auth: only the connection's author (or admin) may rename.
- `DELETE /tool-integrations/:id/connections/:connectionId` — query `?force=true`. Calls adapter `revokeConnection(connectionId)`, drops storage row. Same auth rule.
- `GET /tool-integrations/:id/connections/:connectionId/usage` — returns `{ agents: { id, name }[] }`.

**Adapter-side surface (new).**

- Add optional `ToolIntegration.revokeConnection?(connectionId)` — Composio impl wraps `composio.connectedAccounts.delete(connectionId)`.
- Capabilities flag `supportsRevoke?: boolean` — UI hides Disconnect button when adapter can't actually revoke.

**Open follow-ups.**

- **Concurrent rename races** — two editors rename the same connection at once. Last-write-wins is fine for v1; surface a toast if storage rejects.
- **Cross-author disconnect** — admin disconnecting another author's connection. Out of scope for v1; same gating as #1 (per-author table).
- **Hard-deleted connection still pinned** — runtime should treat missing connection as `inactive` and surface a clear "Reconnect" CTA on the agent, not crash. Audit `resolveStoredToolIntegrations` error paths as part of this work.
- **MCP parity** — same rename/delete shape would apply to MCP clients eventually. Out of scope here; let MCP unification (when it happens) inherit this design.

**Rough sizing.**

| Slice | LOC | Notes |
|---|---|---|
| Adapter `revokeConnection` + capability flag | ~50 | Composio + base + types |
| Server PATCH/DELETE/usage routes + schemas | ~250 | Plus tests |
| Client-js methods + route generation | ~40 | Plus regenerated route-types |
| Picker row UI (rename inline, disconnect confirm) | ~250 | Plus tests |
| Storage indexing / migration (if needed) | 0–~100 | Defer until profiling shows pain |

**Total** ~600 LOC, ~3 commits, ~half a day. **Hard dep on #1 landing first.**
