# PR #17248 review follow-ups

Tracked from the review on `yj/v1-tp-runtime-and-surface`. These items were
intentionally deferred from the in-PR fixes (default-bucket warn,
capability throw → warn, dead static branch removal) because they are too
large or out of scope for that stack. Lands on the C-branch tip so it ships
with the rest of the v1 ToolProvider work.

## FU-A — Reference docs for ToolProvider VNext surface (GA-blocker)

**Where**: `docs/src/content/en/reference/editor/tool-provider.mdx`

The reference page currently documents only the v1 catalog surface
(`listToolkits`, `listTools`, `getToolSchema`). The VNext surface and the
OAuth/connection lifecycle are undocumented.

**Add**:

- `listToolkitsVNext`, `listToolsVNext`, `resolveToolsVNext`
- `authorize`, `getAuthStatus`, `getConnectionStatus`, `getHealth`
- `listConnections`, `listConnectionFields`, `revokeConnection`
- New `/tool-providers/*` HTTP routes (list, authorize, list connections,
  list connection fields, get usage, disconnect, health, update label)
- Stored-agent `toolProviders` config shape:
  `{ connections, tools }` with per-pin `kind` / `scope` / `label`
- Per-pin scope semantics:
  - `per-author` — each author has their own connection bucket
  - `shared` — single bucket visible to all callers (`SHARED_BUCKET_ID`)
  - `caller-supplied` — bucket keyed by
    `requestContext[MASTRA_RESOURCE_ID_KEY]` (wire
    `authConfig.mapUserToResourceId`); falls back to shared `'default'`
    bucket when unwired (emits a one-shot warn)

Coordinate with the Studio UI documentation push so the public surface is
visible to operators before GA.

## FU-B — Composio `listConnections` page-forwarding

**Where**: `packages/editor/src/providers/composio.ts:327-360`

`opts.page` is accepted but never forwarded to the Composio SDK cursor —
`page > 1` silently returns page 1. The inline comment acknowledges this
as a follow-up. The UI does not paginate yet, so the gap is non-blocking.

**Fix**: maintain a per-`(toolkit, userIds[])` cursor cache keyed by `page`
and forward it to `composio.connectedAccounts.list({ cursor })`. The
response already exposes `nextCursor`, which feeds the next page's cache
entry.

## FU-C — Client SDK `getConnectionUsage` missing `toolkit` param

**Where**: `client-sdks/client-js/src/resources/tool-provider.ts:206-210`

The server route `GET /tool-providers/:providerId/connections/:connectionId/usage`
accepts `?toolkit=` (see `connectionUsageQuerySchema` in
`packages/server/src/server/schemas/tool-providers.ts:130-132`) to scope
the usage scan to a single toolkit. The client SDK method passes only
`connectionId` — minor surface skew.

**Fix**: add `toolkit?: string` parameter to `getConnectionUsage` and
forward as a query string. Mirrors the `disconnectConnection` shape which
already accepts `toolkit`.
