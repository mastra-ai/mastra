---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mysql': patch
'@mastra/mongodb': patch
---

Knowledge activity can now be read oldest first, so an agent can work through changes in the order they happened and pick up from the last one it handled.

`knowledge_activity` takes `order: 'oldest'`, and its cursor continues in that order. For code that reads the store directly, `listPageActivity` takes `order: 'asc'` and an `after` position (the `createdAt` and `id` of the last event handled), which returns only events strictly newer than it:

```ts
const { events } = await storage.listPageActivity({ read, since, order: 'asc', after: last })
```

Stores that support this report `supportsActivityAscending`: the in-memory store, LibSQL and PostgreSQL. The default order is still newest first. MySQL and MongoDB don't support it yet. They now refuse `order: 'asc'` and `after` with a `RangeError` instead of quietly returning newest first.
