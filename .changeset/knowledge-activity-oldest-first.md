---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
---

Knowledge activity can now be read oldest first, so an agent can work through changes in order and pick up later from the last one it handled, without missing or repeating any. One exception: when a page or note becomes readable later (a page moved into the scope being read, or a note restamped or restored into view), its earlier changes keep their place in the feed, so they can sit behind a position the agent already holds and are not returned. The move, restamp or restore itself comes through as a new event, so the agent can then read that page's earlier changes newest first.

`knowledge_activity` takes `order: 'oldest'`. Its cursor continues in that order, and it comes back even once the agent has caught up or when nothing has changed yet, so the agent can keep it and resume when new changes land. For code that reads the store directly, `listPageActivity` takes `order: 'asc'`; each event then carries a `position`, and `after` returns only the events past it:

```ts
const { events } = await storage.listPageActivity({ read, since, order: 'asc', after: lastPosition });
```

A write that commits late, or comes from a server whose clock is behind, still comes after a position a reader already holds, so the order isn't always `createdAt` order. On PostgreSQL events come in transaction-id order (the order their transactions first wrote), and a read waits behind any transaction still open on the database server, so a long-open transaction delays new events until it ends.

After a restore that doesn't replay to the end, call `rebaseActivityFeed()` on the store's Knowledge domain once. On PostgreSQL that is a `pg_dump` restore, a point-in-time recovery, an older base backup, or a failover to an asynchronous standby that hadn't received every transaction; on LibSQL it is restoring an older copy of the database file. The store can't detect a failover, so run it after one. Positions from before are then refused with a `RangeError`, and readers start again from `since`. A position ahead of the feed, or one held across `dangerouslyClearAll()` on LibSQL, is refused the same way.

Stores that support this report `supportsActivityAscending`: the in-memory store, LibSQL and PostgreSQL. The default order is still newest first.

Upgrading adds the position columns to the existing activity table and numbers past events in `createdAt` order. On PostgreSQL this rewrites the activity table once, holding an exclusive lock on it while the store initializes, so plan for that on large deployments.
