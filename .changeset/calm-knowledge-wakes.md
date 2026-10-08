---
'@mastra/core': minor
---

Knowledge storage now starts only when Knowledge is used. `storage.init()` no longer creates Knowledge tables; `storage.getStore('knowledge')` creates them on first use. Apps that don't use Knowledge never touch its tables.

When automatic initialization is off (`disableInit: true` or `MASTRA_DISABLE_STORAGE_INIT=true`), call the new `storage.initKnowledge()` yourself, for example from a migration script:

```ts
const storage = new LibSQLStore({ id: 'app', url: 'file:app.db', disableInit: true });
await storage.init();
await storage.initKnowledge();
```
