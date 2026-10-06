---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
---

Added normalized Knowledge v2 storage to LibSQL and PostgreSQL. Knowledge tables are created the first time Knowledge is used, not during ordinary `storage.init()`, so other storage domains keep working on Core releases without Knowledge v2.

Databases initialized by earlier releases contain empty v1 Knowledge tables. These are replaced automatically, because nothing is lost. If the v1 tables hold rows, or the Knowledge schema has been changed in ways Mastra does not recognize, Knowledge refuses to start and leaves everything in place. Existing Knowledge data is not migrated. To replace it, run:

```ts
await storage.stores.knowledge.dangerouslyReset();
```

This deletes every Knowledge row and nothing else. Other storage domains are untouched.
