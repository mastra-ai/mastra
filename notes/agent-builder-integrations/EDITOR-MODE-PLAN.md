# Editor-mode Composio integration with shared connections

> Parent plan: [`./V1-PLAN.md`](./V1-PLAN.md)
> Spec: [`./ARCHITECTURE.md`](./ARCHITECTURE.md)
> Related: [`./V1-PLAN/phase-10-cleanup.md`](./V1-PLAN/phase-10-cleanup.md)

## Goal

Make the new `ToolIntegration` (V1) system work for **code-defined agents** edited through the Studio **CMS** route (`/cms/agents/:id/edit`), with **shared connections** across all editors instead of per-author bucketing.

After this lands, a developer who registers a `ComposioToolIntegration` on a code-defined `Agent` should be able to:

1. Open `/cms/agents/:id/edit/tools` and see all allowed Composio tools as checkboxes.
2. Connect a Composio account once — anyone with editor access can use that connection.
3. Save the agent. The agent picks up the integration tools on next `agent.listTools()` / `agent.generate(...)`.
4. Chat with the agent from `/agents/:id` and see the connected integrations surfaced in the Overview tab.

## Background

### Current state (code-defined agent flow)

```
new Agent({ tools: { weatherInfo } })
        │
        ▼
mastra.getAgentById(id)                        ← static tools only
        │
        ▼
applyStoredOverrides(agent, status, ctx)       ← layers stored overlay (already done)
        │   merges: instructions, tools,
        │           mcpClients,
        │           integrationTools (legacy MCP shape),
        │           toolIntegrations (new V1 shape) ← already plumbed
        ▼
agent.listTools({ requestContext })
```

The runtime hydration is already in place. `applyStoredOverrides` calls `resolveStoredToolIntegrations` for both stored agents and code-defined agents with an overlay. The missing pieces are **(a) a shared-bucket mode on the adapter** and **(b) the CMS edit UI for the new V1 shape**.

### Reference: how MCP already works in the editor

The CMS Tools page (`packages/playground/src/domains/agents/components/agent-cms-pages/tools-page.tsx:230`) already renders **three** tool sections today:

1. **Native tools** — checkbox list from `useTools()`
2. **`<MCPClientList />`** — full CRUD for stored MCP clients per agent
3. **`<IntegrationToolsSection />`** — legacy `ToolProvider` (deprecated)

The MCP section is the closest model for what the new V1 integration UI should feel like in the editor. Worth understanding before designing Phase C:

| Concern | MCP today | What we're building (V1 integration) |
|---|---|---|
| Storage | Two-tier: `stored_mcp_clients` table + agent references by id (`mcpClients: { [id]: { selectedTools } }`) | Inline in agent's `toolIntegrations` JSON column |
| Cross-agent reuse | ✅ MCP client is shared by id | ❌ Per-agent (until improvement #1 lands) |
| Form field | `mcpClients: McpClientFormEntry[]` + `mcpClientsToDelete: string[]` | `toolIntegrations: Record<providerId, ToolIntegrationConfig>` (not yet wired in CMS) |
| Save flow | `collectMCPClientIds` upserts clients, then attaches `{ [id]: { selectedTools } }` to the agent | Mappers serialize the agent's slice directly |
| Auth model | Static headers per client | Per-user OAuth (per-author *or* shared with this plan) |
| Multi-account | ❌ (one client = one set of credentials) | ✅ via `connections[]` + labels |
| UI surface | `MCPClientList` + side dialog (`MCPClientCreateContent`) | `ConnectionsDetail` + `ConnectionPicker` (builder pattern) |

**Implications for this plan:**

- Don't fight the existing CMS layout. The MCP section already establishes the visual pattern (named section, list of attached "thing", side-panel editor for each thing). Phase C should slot in next to it, not on top of it.
- The two-tier MCP storage model is the **right shape** for cross-agent connection reuse. When improvement #1 (`tool_connections` table) lands, it should mirror MCP's pattern: connections live in their own table, the agent references them by id. That work is outside this plan but the CMS UI should be built so it doesn't fight that direction.
- Legacy `IntegrationToolsSection` lives **between** native tools and MCP — replace it inline rather than appending new sections.

### Why this is separate from V1

V1 was scoped to agent-builder + per-author connections. The CMS / editor flow has different product requirements:

- Editors may not own the agent — they are editing someone else's code-defined agent
- Connections must be shareable so workflow agents work for the whole team
- The CMS form schema and save flow are completely different from the builder's

### Current branch reality (read before changing)

| Concern | Status |
|---|---|
| `applyStoredOverrides` merges `toolIntegrations` for code-defined agents | ✅ Done (Phase 4 / `packages/editor/src/namespaces/agent.ts`) |
| `ComposioToolIntegration` adapter | ✅ Done (`packages/editor/src/providers/composio-integration.ts`) |
| Server routes `/tool-integrations/*` | ✅ Done (Phase 5) |
| `ConnectionPicker`, `ConnectionsDetail`, `HealthPill` components | ✅ Done (Phase 6, 9) |
| `useToolIntegrationsBridge`, `useAllIntegrationTools` hooks | ✅ Done |
| CMS edit route `/cms/agents/:id/edit` + `tools-page.tsx` | ✅ Exists, renders native tools + `<MCPClientList />` + legacy `<IntegrationToolsSection />` |
| MCP support on CMS tools page | ✅ Done (`domains/mcps/components/mcp-client-list`) — use as reference pattern |
| `ComposioToolIntegration` shared-bucket mode | ❌ Not implemented (always per-author) |
| CMS form schema includes `toolIntegrations` | ❌ Not wired |
| CMS tools page renders new V1 tool integrations | ❌ Not wired |
| Studio chat sidebar shows connected integrations (V1 shape) | ❌ Not wired |
| Studio chat sidebar shows MCP integrations | ✅ Already shown via `AgentMetadataToolList` |

### Open question resolutions (from prior discussion)

1. **Shared bucket identifier** → configurable per-`ComposioToolIntegration`, default `'editor'`
2. **Legacy `integrationTools` UI** → keep both during transition; mark legacy deprecated
3. **Studio chat sidebar** → read-only health pill only; CMS is the management surface
4. **`authorId` in shared mode** → still flows through for audit/logging, ignored for `userId` resolution
5. **Per-agent connection labels** → keep current behavior (label per pin, not global)
6. **Relationship to MCP** → MCP stays a separate parallel path for now. Its two-tier storage model (clients-table + agent-references-them) is the long-term shape we want for V1 integrations too, but unifying them is a follow-up, not a blocker. See [`./COMPOSIO-OLD-VS-NEW.md`](./COMPOSIO-OLD-VS-NEW.md) for the MCP unification discussion.

## Scope (overall)

Five phases. Each phase is one focused commit on `yj/mm/v1-integrations-plan` (or a sibling branch), kept small enough to ship as an individual PR if needed.

- **Phase A** — Adapter: `connectionScope` option for shared bucket
- **Phase B** — CMS form: extend schema + mappers for `toolIntegrations`
- **Phase C** — CMS UI: surface new V1 tool integrations on `tools-page.tsx`
- **Phase D** — Studio chat: read-only integration health on Overview tab
- **Phase E** — Docs + e2e: usage doc, deprecation markers, smoke test

---

## Phase A — `connectionScope` on the adapter

### Goal

Allow `ComposioToolIntegration` to bucket connections under a **shared, constant** user-id instead of per-author. Default behavior unchanged.

### Scope

- `packages/core/src/tool-integration/tool-integration.ts`
  - Add `connectionScope?: 'author' | 'shared'` to `BaseToolIntegrationOptions` (default `'author'`)
  - Add `sharedBucketId?: string` (default `'editor'`)
- `packages/editor/src/providers/composio-integration.ts`
  - In `authorize`, `resolveTools`, `listConnections`, `getConnectionStatus`:
    - If `connectionScope === 'shared'`: return `config.sharedBucketId` regardless of `authorId` / `requestContext`
    - Otherwise: keep existing behavior (prefer `authorId`, fall back to `requestContext`, fall back to `'default'`)
- `packages/server/src/server/handlers/tool-integrations.ts`
  - `resolveOwnerId` already returns the resolved user. The adapter overrides this when in shared mode — no server change needed unless we want the route to short-circuit.
- `packages/server/src/server/handlers/tool-integrations.ts` (defensive)
  - Audit: ensure resolved `userId` from server is passed to adapter, and adapter has the final say.

### Tests

- `packages/editor/src/providers/composio-integration.test.ts`
  - `connectionScope: 'shared'` ignores `authorId` and uses default `'editor'` bucket
  - `connectionScope: 'shared'` with custom `sharedBucketId: 'team-prod'` uses `'team-prod'`
  - `connectionScope: 'author'` (default) preserves existing behavior

### Acceptance

- Default behavior unchanged for the agent-builder flow (per-author)
- A code-defined `ComposioToolIntegration({ connectionScope: 'shared' })` creates and resolves connections under one shared bucket
- Two different signed-in users see the **same** existing connections when calling `listConnections`

### Out of scope

- UI surfacing of which scope is in use (deferred to Phase E doc)
- Migration of existing per-author connections to shared bucket (not needed — opt-in only)

---

## Phase B — CMS form schema + mappers for `toolIntegrations`

### Goal

The CMS agent-edit form (`/cms/agents/:id/edit`) carries `toolIntegrations` form state, persists it, and hydrates from the stored overlay. No UI yet.

### Scope

- `packages/playground/src/domains/agents/components/agent-edit-page/utils/form-validation.ts`
  - Add `toolIntegrations` to the schema (reuse the shape from `AgentBuilderEditFormSchema`)
  - Reuse `superRefine` for label uniqueness + duplicate-connectionId checks from the builder schema
- `packages/playground/src/domains/agents/utils/compute-agent-initial-values.ts`
  - Hydrate `toolIntegrations` from the stored overlay record
  - For code-defined agents with no overlay: default to `{}`
- `packages/playground/src/domains/agents/utils/agent-form-mappers.ts`
  - Add `transformToolIntegrationsForApi` (mirrors the builder's `formValuesToSaveParams`)
  - Add `normalizeToolIntegrationsToForm` for the read path
- `packages/playground/src/domains/agents/hooks/use-agent-cms-form.ts`
  - Pass `toolIntegrations` through `transformToolIntegrationsForApi` on save
  - Wire into both create + update paths
- `packages/playground/src/domains/agents/components/agent-edit-page/use-agent-edit-form.ts`
  - Initialize `toolIntegrations` from `initialValues`

### Tests

- `packages/playground/src/domains/agents/utils/__tests__/agent-form-mappers.test.ts` (new)
  - `transformToolIntegrationsForApi` strips `toolService` from form values; persists `kind`, `connections`, `tools` correctly
  - `normalizeToolIntegrationsToForm` denormalizes `toolService` back onto each tool entry
- `packages/playground/src/domains/agents/utils/__tests__/compute-agent-initial-values.test.ts`
  - Code-defined agent + overlay → `toolIntegrations` populated
  - Code-defined agent + no overlay → empty `toolIntegrations`
- Schema test for label uniqueness + duplicate-connectionId

### Acceptance

- CMS form round-trips `toolIntegrations` form ↔ storage without loss
- Existing legacy `integrationTools` form field still works (untouched)
- TypeScript clean across `playground`

### Out of scope

- UI rendering (Phase C)
- Server-side handler changes (already handled by Phase 5)

---

## Phase C — CMS tools page renders new V1 integrations

### Goal

`/cms/agents/:id/edit/tools` shows the new V1 integration tools as checkable rows alongside native tools, with inline `ConnectionPicker` per tool service. Legacy `integrationTools` section stays but is marked deprecated.

The new section should slot **between** the legacy `<IntegrationToolsSection />` and `<MCPClientList />` so the editor learns the same visual language we already use for MCP (named section, attached items, side-panel editor).

### Scope

- `packages/playground/src/domains/agents/components/agent-cms-pages/tools-page.tsx`
  - Add a new "Integrations" section. Placement: between the legacy `<IntegrationToolsSection />` and `<MCPClientList />` so users see native → legacy (deprecated) → V1 → MCP.
  - Reuse `useToolIntegrationsBridge` from `agent-builder/hooks` — extract to a shared location if needed (`packages/playground/src/domains/tool-integrations/hooks/`)
  - Render checkboxable rows from `useAllIntegrationTools` filtered by allowlist
  - Inline `ConnectionPicker` when a tool is checked without a connection (or move to a separate panel like Builder's `ConnectionsDetail`)
  - Mark legacy `IntegrationToolsSection` with a deprecation banner: "Legacy MCP-style integrations. Use the new Integrations section instead."
  - Do **not** touch `<MCPClientList />` — it stays as-is. MCP unification is a separate effort.
- `packages/playground/src/domains/tool-integrations/hooks/use-tool-integrations-bridge.ts` (move from builder if shared)
  - If the bridge needs to stay generic, make `formValues` / handlers pluggable
- `packages/playground/src/domains/agents/components/agent-cms-sidebar/use-sidebar-descriptions.ts`
  - Include `toolIntegrations` count in the sidebar tool count (note: existing line already sums `tools` + legacy `integrationTools` — extend, don't replace)

### Tests

- `packages/playground/src/domains/agents/components/agent-cms-pages/tools-page.test.tsx` (extend or new)
  - New section renders when `ComposioToolIntegration` is registered
  - Checking an integration tool with no connection shows the connect prompt
  - Saving persists the selection (mocked save)
  - Legacy section shows deprecation banner

### Acceptance

- A code-defined agent with `ComposioToolIntegration({ connectionScope: 'shared' })` registered:
  - Shows Composio tools in the CMS tools page
  - Allows connecting a Gmail account
  - Persists the selection on save
  - `agent.listTools()` returns the new tools at runtime

### Out of scope

- Studio chat sidebar (Phase D)
- Removing legacy `IntegrationToolsSection` (Phase 10b / next breaking-change window)

---

## Phase D — Studio chat sidebar: read-only integration health

### Goal

The Overview tab on `/agents/:id` shows a compact "Integrations" section listing connected tool services with a health pill. No editing — links out to CMS for management.

MCP tools already appear in `AgentMetadataToolList` because they're merged into `agent.listTools()`. This phase adds a **separate** section dedicated to V1 integrations so users can see connection health at a glance without scrolling through the flat tool list.

### Scope

- `packages/playground/src/domains/agents/components/agent-metadata/agent-metadata.tsx`
  - Add a new `AgentMetadataIntegrationList` section below `AgentMetadataToolList`
  - Reads stored overlay (if any) via existing hooks
  - Renders one row per `(providerId, toolService)` with `HealthPill` per service
  - Each row links to `/cms/agents/:id/edit/tools`
- `packages/playground/src/domains/agents/components/agent-metadata/agent-metadata-integration-list.tsx` (new)
  - Pure presentation; receives `toolIntegrations` + `health` props

### Tests

- `packages/playground/src/domains/agents/components/agent-metadata/agent-metadata-integration-list.test.tsx` (new)
  - Renders one row per tool service
  - Empty `toolIntegrations` → does not render the section
  - Click row → navigates to CMS tools page

### Acceptance

- Chat sidebar shows connected integrations for any code-defined agent with an overlay
- No editing affordance on this surface
- Pill state matches what CMS shows

### Out of scope

- Add/remove from chat sidebar
- Per-tool granular health (only per-service rollup)

---

## Phase E — Docs + e2e

### Goal

Public-facing docs explain the new flow, the legacy `integrationTools` field is marked deprecated, and an e2e test locks in the round-trip.

### Scope

- `docs/src/content/en/docs/integrations/composio.mdx` (or wherever Composio docs live)
  - New section: "Adding Composio tools to a code-defined agent"
  - Cover: registering `ComposioToolIntegration` on `Mastra`, choosing `connectionScope`, opening CMS, connecting an account, runtime behavior
- `docs/src/content/en/docs/integrations/migration.mdx` (or in the same doc)
  - "Migrating from legacy `ToolProvider`" — point to the shim, note deprecation timeline
- `e2e-tests/playground/tests/cms-tools-integration.spec.ts` (new)
  - Boot example app with `ComposioToolIntegration({ connectionScope: 'shared' })` (use Composio sandbox or mock at the SDK boundary)
  - Open `/cms/agents/:id/edit/tools`
  - Verify integration section renders
  - (Skip OAuth: assert connect button is wired)
- Changeset: `.changeset/editor-mode-composio.md`

### Acceptance

- Docs build clean
- E2E test passes locally
- Changeset queued for next release

### Out of scope

- Removing legacy `ToolProvider` (Phase 10b)
- Arcade.dev support (post-V1)

---

## Sequencing and dependencies

```
A (adapter) ─┐
             ├─→ C (CMS UI) ─→ D (chat sidebar) ─→ E (docs + e2e)
B (form)  ───┘
```

- A and B are independent — can be done in parallel
- C depends on both A and B
- D depends on C
- E should be last

## Verification checklist (end-to-end smoke)

After all phases land:

- [ ] Register `new ComposioToolIntegration({ apiKey, connectionScope: 'shared' })` in an example app
- [ ] Define a code-defined agent in that example app
- [ ] Boot the app, sign in as user A
- [ ] Open `/cms/agents/:id/edit/tools`, check a Gmail tool, connect a Gmail account, save
- [ ] Sign out, sign in as user B
- [ ] Open the same page — verify the Gmail account shows as already connected
- [ ] Open `/agents/:id`, verify the Overview tab shows "Integrations: Gmail ✓"
- [ ] Ask the agent to fetch emails — verify the call succeeds with the shared connection

## Rough sizing

| Phase | LOC | Commits | Risk |
|---|---|---|---|
| A | ~150 | 1 | Low — adapter-only, additive |
| B | ~300 | 1–2 | Low — schema + mappers, no UI |
| C | ~400 | 2–3 | Medium — shared bridge extraction, UI integration |
| D | ~150 | 1 | Low — pure read-only UI |
| E | ~200 | 1–2 | Low — docs + 1 e2e |

**Total**: ~1200 LOC across ~8 commits. Similar shape to two V1 phases combined.

## Open follow-ups (post-plan)

- **Mixed scope** — what if one agent wants `connectionScope: 'author'` and another `'shared'` in the same app? Today `ComposioToolIntegration` is a singleton with one mode. We'd need either two registered instances with different `id`s or per-agent mode override. Defer until requested.
- **Connection ownership transfer** — when a shared connection is created by user A and user A leaves the team, do we surface "orphaned" state? Out of scope for v1.
- **Audit log** — should we log `authorId` when a shared connection is created? Use case for ops/security teams. Defer.
- **CMS create flow** — this plan covers edit only. Creating a brand-new stored agent from CMS that uses code-defined integrations may need similar wiring.
- **MCP ↔ V1 unification** — long-term, MCP could be wrapped as a `ToolIntegration` adapter so the editor has one section instead of three. Right trigger is when remote MCP gains OAuth (multi-account / per-user auth). Until then they coexist. Tracked in [`./COMPOSIO-OLD-VS-NEW.md`](./COMPOSIO-OLD-VS-NEW.md) improvement list.
- **`tool_connections` table parity with MCP** — improvement #1 (persist labels across agents) should adopt MCP's two-tier storage shape (connections in their own table, agent references by id). When that lands, the CMS UI from Phase C should switch to the cross-agent list naturally without form-schema churn.
