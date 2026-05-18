# Cross-author connection visibility (#6)

Status: planned (not started)
Depends on: #1 (`tool_connections` storage) — already shipped on this branch.

---

## Problem

Today every `tool_connections` route hard-resolves `authorId` from the caller via `resolveOwnerId(requestContext)`. This means an admin user cannot:

- See connections owned by other users in the picker.
- Disconnect another user's connection (e.g. when a teammate leaves).
- View cross-user usage counts.

It also means cross-tenant fleet-wide management is impossible — each admin only ever sees their own bucket.

## Goal

- Admin users can list, view usage of, and disconnect any author's connection.
- Non-admins keep current per-author behavior unchanged.
- Cursor pagination is shipped across the stack so we don't hit a fleet-size cliff.

## Out of scope

- Renaming connections (removed earlier on this branch).
- Cross-author display name resolution. v1 surfaces raw `authorId` — a real
  user-directory lookup is a follow-up.
- Composio-side filtering by created-by user. We seed `userIds[]` from
  `tool_connections` instead.
- Audit log of admin disconnects. Follow-up.

---

## Key finding: Composio supports multi-user listing

`composio.connectedAccounts.list({ userIds: string[], cursor, limit })` accepts
**multiple userIds in a single call** and returns a cursor-paginated response
shaped `{ items, nextCursor }`. That removes the original "N calls per author"
perf concern — we can list 1000 authors in one HTTP call. Pagination is
purely about result-set size, not author count.

This dictates the adapter shape below.

---

## Surfaces

### Storage (no change)

`ToolConnectionsStorage.list({ authorId?, providerId?, toolService? })` already
exists. No schema or method changes.

### Adapter (`ToolIntegration.listConnections`)

```ts
listConnections(opts: {
  toolService: string;
  userIds?: string[];     // NEW — primary path
  userId?: string;        // kept for backward compat, normalized to [userId]
  cursor?: string;        // NEW
  limit?: number;         // NEW — default 50, max 200
}): Promise<{
  items: ExistingConnection[];   // each item now carries `authorId`
  nextCursor?: string;           // NEW
}>;
```

`ExistingConnection` gains `authorId: string` so the UI can attribute each row.

`ComposioToolIntegration.listConnections` is a near 1:1 passthrough to the
Composio SDK now that the SDK already supports the same shape.

### Server routes

#### `GET /tool-integrations/:id/connections`

Query params:

- `toolService` (required, today)
- `authorId?` (new; ignored for non-admins)
- `cursor?` (new)
- `limit?` (new; default 50, max 200)

Behavior:

- Resolve caller `authorId` via `resolveOwnerId(requestContext)`.
- `hasAdminBypass(requestContext, 'tool-integrations')` decides whether the
  caller can scope to other authors.
- **Strategy B (default):** seed `userIds[]` from
  `toolConnections.list({ providerId, toolService, authorId? })`. Pass that
  set into the adapter. Cursor pagination drives the adapter call.
- Non-admin + `authorId` param → ignored, falls back to caller's id.
- Admin + no `authorId` → all authors known to `tool_connections` for this
  provider/service.
- Admin + `authorId=X` → just X.

Response now includes `nextCursor` and each item carries `authorId`.

#### `DELETE /tool-integrations/:id/connections/:connectionId`

- Look up the row from `tool_connections.get`.
- If caller owns it OR `hasAdminBypass(rc, 'tool-integrations')` → allow.
- Else 403.

#### `GET /tool-integrations/:id/connections/:connectionId/usage`

- Same auth check as `DELETE`.
- Admin gets the full cross-author usage count.

### Client-js

- `listConnections` accepts `authorId?`, `cursor?`, `limit?` and returns
  `nextCursor?` plus `authorId` on each item.
- Regen route types (`pnpm --filter ./client-sdks/client-js generate:route-types`).
- No new methods.

### Picker UI

- New `useInfiniteConnections` hook wrapping `useInfiniteQuery` over the
  paginated endpoint.
- "Load more" button under the existing connections list, visible while
  `nextCursor` is non-null.
- **Author filter dropdown** rendered only when admin: `Mine` (default) /
  `All authors`. Non-admins don't see the dropdown at all.
- Per-row `authorId` badge displayed when the row's `authorId` differs from
  the caller's id (i.e. admin viewing someone else's row).
- Disconnect confirm dialog grows an "Owned by `{authorId}`" line when the
  caller isn't the owner.

### Permissions

- Resource string: `'tool-integrations'`.
- Admin bypass via any of: `*`, `tool-integrations:*`, `tool-integrations:admin`.
- EE deployments need to grant `tool-integrations:admin` to the relevant
  role. OSS works unchanged (no RBAC → `hasAdminBypass` returns false →
  per-caller behavior preserved).

---

## Tests

### Storage
Already covered by the in-memory and LibSQL parity tests shipped with #1.

### Server (`tool-integrations.test.ts`)
- Admin lists all authors (multi-bucket result).
- Admin lists a specific author via `authorId` param.
- Non-admin with `authorId` param: parameter ignored, only caller's rows.
- Admin disconnects another author's connection: 200, row deleted, adapter
  invoked.
- Non-admin disconnect of someone else's connection: 403, row untouched.
- Admin reads usage for another author's connection: full count returned.
- Non-admin reads usage for someone else's connection: 403.
- Cursor round-trip: page 1 returns `nextCursor`, page 2 with that cursor
  returns the next slice, page N returns no `nextCursor`.
- Multi-author seeding: when no `userIds` are in `tool_connections`, the
  adapter is not called and the response is empty.

### Client-js
- `pnpm --filter ./client-sdks/client-js generate:route-types` passes.
- Types compile (`pnpm --filter ./client-sdks/client-js typecheck`).

### Picker
- Author filter dropdown is rendered only when admin capability is present.
- "Load more" appears when `nextCursor` is returned; clicking fetches the
  next page and appends rows.
- Owner badge renders for cross-author rows only.
- Disconnect confirm shows the owner id when not the caller.

---

## Commit boundary

1. `adapter: paginate listConnections, accept userIds[]` — interface, Composio
   implementation, adapter tests.
2. `server: cross-author + cursor on list + admin guard on delete/usage` —
   route changes, `hasAdminBypass` plumb-through, multi-bucket seeding from
   `tool_connections`, server tests.
3. `client-js: pagination + authorId on list response` — types, regen.
4. `picker: infinite query + author filter + owner badge` — UI changes and
   picker tests.
5. `tests: end-to-end admin scenarios` — any cross-cutting test gaps after
   the above commits.

---

## Open follow-ups

- Resolve `authorId` → display name in the picker. Needs a user-directory
  helper that doesn't currently exist on `Mastra`. Until then we surface
  raw ids as small monospaced badges.
- Per-author "filter by specific author" entry (instead of binary
  Mine/All). Probably needs the directory helper above.
- Audit log of admin disconnects — likely belongs in EE auth, not here.
- Orphan-Composio-account discovery: optional admin mode that bypasses
  Strategy B seeding to expose Composio accounts not pinned to any agent.
  Useful when offboarding users.

---

## Sizing

- Adapter: ~30 LOC + tests.
- Server: ~120 LOC + tests.
- Client-js: ~20 LOC + regen.
- Picker: ~120 LOC + tests.

**Total: M-size, 1 PR, ~1 day of focused work.**

---

## Notes

- Strategy B (seed `userIds[]` from `tool_connections`) is the right default
  but worth keeping a back-door query flag for the orphan-discovery case
  above. Not v1.
- The Composio SDK's `userIds[]` parameter is the key enabler here — without
  it this would have been an N+1 problem.
- Pagination across multiple `userIds` is delegated to Composio's cursor.
  We do not implement local pagination over `tool_connections` rows; we
  pass everything in one `userIds[]` array and let the provider paginate.
  If `tool_connections` itself ever grows to thousands of rows per
  provider, we'd add a storage-side cursor too. Not a v1 concern.
