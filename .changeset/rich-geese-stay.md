---
'@mastra/libsql': minor
'@mastra/pg': minor
---

Added Knowledge v2 storage to LibSQL and PostgreSQL. Knowledge tables are created the first time Knowledge is used, not during ordinary `storage.init()`, so other storage domains keep working on Core releases without Knowledge v2.

Databases initialized by earlier releases contain v1 Knowledge tables. Knowledge v1 was experimental and its data is not migrated: the first time Knowledge is used, unmodified v1 tables are dropped and the v2 schema is created, deleting any v1 Knowledge rows. Back up the v1 Knowledge tables before upgrading if you need their contents. If the Knowledge schema has been changed in ways Mastra does not recognize, for example extra tables, indexes, views, or triggers, Knowledge refuses to start and leaves everything in place. To replace it, run:

```ts
await storage.stores?.knowledge?.dangerouslyReset();
```

This deletes every Knowledge row, including the old `mastra_knowledge_cursors` table, and nothing else. Other storage domains are untouched. In PostgreSQL, if another table, view, or constraint depends on a Knowledge table, the reset fails and leaves everything in place instead of dropping that object.
