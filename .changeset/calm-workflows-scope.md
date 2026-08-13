---
'@mastra/server': minor
---

Added server-derived ownership for dynamic workflow list, get, and upsert routes.

Authenticated callers only list, get, and upsert definitions owned by the author in their request context. Callers with `stored-workflows:admin` can inspect definitions across authors and update an owned definition without transferring it. Legacy definitions without an author remain hidden from regular callers and read-only for admins.

Deletion, execution, and nested workflow references aren't owner-scoped by this change.
