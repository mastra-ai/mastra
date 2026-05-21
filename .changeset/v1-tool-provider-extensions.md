---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/editor': minor
'@mastra/libsql': minor
'@mastra/clickhouse': minor
'@mastra/cloudflare': minor
'@internal/playground': minor
---

Extend `ToolProvider` with a v1 user-driven surface for the editor / agent
builder. The existing static surface (`listToolkits`, `listTools`,
`resolveTools`, `getToolSchema`) is unchanged; everything added here is
**opt-in via capability flags**, so existing providers (including
`ArcadeToolProvider`) keep working without modification.

**New on the `ToolProvider` interface (all optional)**:

- `capabilities` — declare what the provider supports
  (`multipleConnectionsPerToolkit`, `batchConnectionStatus`,
  `reauthorizeReusesConnectionId`, `supportsRevoke`).
- `authorize` / `getAuthStatus` — OAuth round-trip for end-user
  connections.
- `listConnections` / `listConnectionFields` / `getConnectionStatus` —
  enumerate and inspect end-user connections.
- `revokeConnection` — provider-side disconnect.
- `getHealth` — surface health pill state.
- `listToolkitsV2` / `listToolsV2` / `resolveToolsV2` — v2 shapes that
  thread `requestContext` and `authorId` for per-user resolution. The
  legacy methods are auto-shimmed by `BaseToolProvider`.

**Connection scope**:

`ToolProviderConnection.scope` is `'shared' | 'per-author' | 'caller-supplied'`.

- `shared` — credentials are reused across authors (bucketed under
  `SHARED_BUCKET_ID`).
- `per-author` — credentials are scoped to the author (default for
  Agent Builder).
- `caller-supplied` — credentials are bucketed under
  `ctx[MASTRA_RESOURCE_ID_KEY]` so a single agent definition can serve
  multiple tenants. Missing identity at runtime raises
  `MastraError('CALLER_SUPPLIED_USER_ID_MISSING')`; the authorize route
  rejects with HTTP 400.

**New storage domain**:

`Storage.toolProviderConnections` (table `mastra_tool_provider_connections`).
Composite primary key `(authorId, providerId, connectionId)`. LibSQL,
Clickhouse, and Cloudflare KV all register the new table. There is no
migration — this is a new column set; restart against a fresh DB or
let the boot path create the table.

**New routes** (prefix `/api/tool-providers/`):

- `POST   /:providerId/authorize`
- `GET    /:providerId/auth-status/:authId`
- `POST   /:providerId/connection-status`
- `GET    /:providerId/connections`
- `GET    /:providerId/connection-fields`
- `DELETE /:providerId/connections/:connectionId`
- `GET    /:providerId/connections/:connectionId/usage`
- `GET    /:providerId/health`

All routes require authentication. `shared` connections are visible to
all callers; `per-author` and `caller-supplied` connections require
ownership or `tool-providers:admin` permission for cross-author
enumeration.

**New client-js surface**:

`client.toolProviders.{authorize, getAuthStatus, getConnectionStatus,
listConnections, listConnectionFields, disconnectConnection,
getConnectionUsage, getHealth}`.

**New playground UI**:

- `<ToolProvidersSection form={form} allowedScopes={['per-author', 'shared']} />`
  mounts in both Agent Builder and the CMS agent editor tools tab.
- `<ConnectionPicker />` — per-toolkit OAuth and existing-connection
  selection with scope toggle.
- `<HealthPill />` — surfaces `getHealth` state in the agent header.
- Admins see a cross-author filter dropdown when the `rbac`
  capability is enabled and the user holds `tool-providers:admin`.

**`ComposioToolProvider`** in `@mastra/editor/composio` now implements
the full v1 surface (OAuth, multi-account, dynamic auth fields,
per-scope buckets, lifecycle, health). `ArcadeToolProvider` continues to
expose only the static surface.

**Surface-locked picker scopes**:

`<ConnectionPicker />` and `<ToolProvidersSection />` accept
`allowedScopes` to restrict the visibility radios. When the host passes a
single scope, the picker hides the radios entirely and auto-seeds the
new-connection draft to that scope. The infinite-connections hook also
forwards `scope` to the server so cross-scope rows never come back. The
Agent Builder mounts with `['per-author']` (single-author surface) and
the CMS agent editor mounts with `['caller-supplied']` (declare-only,
host app resolves end-users at runtime via `MASTRA_RESOURCE_ID_KEY`).

The Mine/All admin cross-author dropdown is also removed from the inline
picker. Inside a surface-locked picker it could never produce a pinnable
result (other authors' per-author connections live in their own buckets
and cannot be cross-pinned at runtime). The server-side admin author
filter on `GET /api/tool-providers/:providerId/connections?authorId=…`
is preserved for a future global admin connections page.

The `allowedScopes` prop on `<ConnectionPicker />` and
`<ToolProvidersSection />` is replaced by a required `scope: Scope` prop.
Surfaces declare the single scope they own (Builder → `per-author`, CMS
Editor → `caller-supplied`); the in-picker visibility chooser is removed.
The server-side `scope` query filter on
`GET /api/tool-providers/:providerId/connections` is unchanged.

**Fix: `toolProviders` survives reload on `PATCH /stored/agents/:id`**:

The update handler destructured `toolProviders` from the request body and
passed it into `agentsStore.update`, but omitted it from the snapshot
config handed to `handleAutoVersioning`. The new version row was written
without the field, so on reload `getByIdResolved` returned the agent with
no `toolProviders` and the picker appeared empty. `toolProviders` is now
included in the snapshot config alongside the other agent-config fields.

**Labels are required when creating a new connection.** The empty-state
`<ConnectionPicker />` now disables Connect until the user types a label,
so every persisted `tool_integration_connections` row ships with a real
account name. The "Label is required" copy no longer appears on unpinned
existing rows — pinning inherits the persisted label as before, and rows
without a persisted label fall back to a truncated-id display name. The
`validateLabels` `>= 2` uniqueness rule still protects legacy rows that
lack a persisted label.

Add a Delete action to existing-connection rows in the inline
`ConnectionPicker`. Inactive connections (status `failed`, `expired`,
`initiated`, etc.) can now be removed from the picker via the same
"Disconnect everywhere" confirm dialog used by pinned rows. Previously the
Pin button was disabled on inactive rows with no way to clean them up
without leaving the picker.

Agent Builder Tools tab now lists Composio tools alongside code tools,
agents, and workflows as `type: 'integration'` rows in a single flat list.
Toggling an integration row writes to
`toolProviders[providerId].tools[<SLUG>]` (never the native `tools`
allowlist). Rows whose toolkit has no pinned connection show an inline
"Set up connection" button that switches the active tab to Connections.
The Connections tab remains the source of truth for OAuth, labels, and
scopes.

Fix `agentBuilderTool` silently dropping Composio (integration) tool
selections. `routeToolInputToFormKeys` now returns a fourth bucket
(`toolProvidersFragment`) keyed by `providerId` → `slug` → `{ toolkit,
description? }`, and the builder hook shallow-merges it into the form's
`toolProviders[providerId].tools` so user-pinned connections survive. The
builder client tool is also gated on `useAllProviderTools().isLoading` to
avoid exposing a partially-populated `tools` enum/description to the LLM
on agent create — without the gate, the LLM could fire before integration
ids were available and silently omit them.

Fix saved `toolProviders` never reaching the runnable `Agent`.
`createAgentFromStoredConfig` now calls `resolveStoredToolProviders`
alongside the legacy `integrationTools` path, threading `requestContext`
and the stored `authorId` so per-author (Agent Builder) and
caller-supplied (Studio agent editor) Composio connections resolve
correctly at execute time. Without this, agents saved through either
surface persisted their Composio selections but the LLM never saw any of
those tools.

Drop the redundant "Mark caller-supplied" button from `ConnectionPicker`.
Previously the Studio agent editor showed a warning card + button to
"mark" the toolkit as caller-supplied, which was leftover UX from a
short-lived 3-way visibility radio that no longer exists. With `scope`
now a required prop, the editor is hard-locked to `caller-supplied` and
has no choice to make — so the picker now auto-stamps the sentinel pin
on mount via `useEffect` and renders it as a normal pinned row with the
existing "Shared (caller-supplied)" badge. The `handleAddCallerSupplied`
guard keeps the effect idempotent on re-mount with persisted state. The
Agent Builder (`per-author`) empty state is unchanged.

Drop the **Caller-supplied** badge from `ConnectionPicker`; replace the
row's secondary copy with **"User ID must be supplied at runtime from
request context."** With the editor surface hard-locked to
`caller-supplied` scope, the badge labeled a non-choice; the simplified
copy keeps the runtime-resolution reminder users actually need.

Hide the per-row actions kebab on caller-supplied pins in `ConnectionPicker`.
Reauthorize and Disconnect were already gated `!isCallerSupplied`, and
Unpin would be immediately undone by the `useEffect` that auto-stamps
the sentinel pin on mount — so the entire trigger is removed for those
rows. Per-author rows retain the full Reauthorize / Unpin / Disconnect
menu.

Reconcile this branch after merging `yj/magnificent-marquess`. Upstream
introduced an atomic per-field split of `agentBuilderTool` and added the
Browser / Integrations tabs to the builder profile; the merge wiped this
branch's Connections tab, the Tools-tab "Set up connection" affordance for
unauthenticated integrations, and the `ModelPolicyProvider surface="editor"`
wrappers in the CMS layouts. The Connections tab + `ToolProvidersSection`
are re-applied on top of the new shape, `set-agent-tools` now merges
`toolProvidersFragment` into the form's `toolProviders` (preserving the
existing `connections` map), and an `integrationToolsLoading` gate keeps the
LLM from firing `set-agent-tools` against a stale tool-id enum while
`useAllProviderTools` is still fanning in. `ModelPolicyProvider` is
restored around both CMS `create-layout` and `edit-layout`.

Restore legacy permissive behavior for `caller-supplied` connections: when
`requestContext[MASTRA_RESOURCE_ID_KEY]` is missing, the runtime resolver
falls back to a shared `'default'` user bucket instead of throwing
`CALLER_SUPPLIED_USER_ID_MISSING`. Matches `ComposioToolProvider` semantics
on `main`. Multi-tenant deployments should still wire
`authConfig.mapUserToResourceId` to avoid cross-tenant bucket sharing.
