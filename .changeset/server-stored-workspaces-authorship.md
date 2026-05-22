---
'@mastra/server': minor
'@mastra/core': patch
---

Gate stored-workspace handlers by author. Previously any authenticated caller within a tenant could list, read, update, or delete another user's workspace.

**Behavior changes**

- `POST /stored/workspaces` — server stamps `authorId` from the authenticated caller; any body-provided `authorId` is ignored.
- `GET /stored/workspaces/:id`, `PATCH /stored/workspaces/:id`, `DELETE /stored/workspaces/:id` — return `404 Not found` unless the caller is the owner, an admin (`*`), or holds `stored-workspaces:<action>[:<id>]`.
- `GET /stored/workspaces` — filters to the caller's own rows plus legacy unowned records; admins still see every row.
- Legacy workspaces created before this change (no `authorId`) remain accessible to any authenticated caller for backwards compatibility.

**Example**

```ts
// Client POST body — authorId is ignored if sent
await fetch('/stored/workspaces', {
  method: 'POST',
  body: JSON.stringify({ name: 'My workspace', authorId: 'someone-else' }),
});

// Stored row — authorId is stamped from the authenticated caller
// {
//   id: 'my-workspace',
//   name: 'My workspace',
//   authorId: 'user_abc123', // from requestContext, NOT from body
//   ...
// }
```

**Migration**

- Existing rows with `authorId === null/undefined` remain readable/writable by any authenticated caller — no action required for backwards compatibility.
- To lock down legacy rows, backfill `authorId` directly in the `workspaces` table with the original creator's id.
- For service accounts or tooling that need cross-user access, grant `stored-workspaces:*` (or per-id `stored-workspaces:<action>:<id>`) instead of relying on the legacy unowned bypass.
- Admins (callers with `*`) continue to see and mutate every row regardless of `authorId`.

The `@mastra/core` patch regenerates `permissions.generated.ts` to include the `auth` and `infrastructure` resources that already had routes on `main`.
