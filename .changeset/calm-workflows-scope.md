---
'@mastra/server': minor
---

Added server-derived ownership for dynamic workflow list, get, and upsert routes.

Authenticated callers only list, get, and upsert definitions owned by the author in their request context. Callers with `stored-workflows:admin` can inspect definitions across authors and update an owned definition without transferring it. Legacy definitions without an author remain hidden from regular callers and read-only for admins.

Deletion, execution, and nested workflow references aren't owner-scoped by this change.

Previously, management routes could accept a caller-selected author. Hosts should now map verified identity into the request context and omit author ownership from request bodies:

```ts
authConfig: {
  mapUserToResourceId: user => user.id,
}
```

The built-in list, get, and upsert routes derive ownership from that server-populated resource ID. Cross-author administration requires `stored-workflows:admin`.
