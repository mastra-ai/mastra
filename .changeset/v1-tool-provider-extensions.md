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
