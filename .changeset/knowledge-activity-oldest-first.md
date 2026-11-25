---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge activity can now be read oldest first, so an agent can work through changes in order and pick up later from the last one it handled, without missing or repeating any.

`knowledge_activity` takes `order: 'oldest'`. Its cursor continues in that order, and it comes back even once the agent has caught up or when nothing has changed yet, so the agent can keep it and resume when new changes land. For code that reads the store directly, `listPageActivity` takes `order: 'asc'`; each event then carries a `position`, and `after` returns only the events past it:

```ts
const { events } = await storage.listPageActivity({ read, since, order: 'asc', after: lastPosition });
```

A write that commits late, or comes from a server whose clock is behind, still comes after a position a reader already holds, so the order isn't always `createdAt` order. On PostgreSQL events come in transaction-id order (the order their transactions first wrote), and a read waits behind any transaction still open on the database server, so a long-open transaction delays new events until it ends. After restoring a PostgreSQL database from `pg_dump`, call `rebaseActivityFeed()` on the store's Knowledge domain once; positions from before the restore are then refused and readers start again from `since`.

Stores that support this report `supportsActivityAscending`: the in-memory store, LibSQL and PostgreSQL. The default order is still newest first. MySQL and MongoDB don't support it yet. They now refuse `order: 'asc'` and `after` with a `RangeError` instead of quietly returning newest first.
