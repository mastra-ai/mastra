---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
---

Added `collectionExists(name)` to Factory storage so a domain can tell whether a table already exists before registering it. Supported by `LibSQLFactoryStorage` and `PgFactoryStorage`; it is an optional capability, so other backends keep working unchanged.

```ts
if (await storage.collectionExists?.('work_items')) {
  await storage.ensureCollections([WORK_ITEMS_SCHEMA]);
}
```
