---
'@mastra/libsql': minor
---

Added `persistenceLocation` to libSQL observability storage. Files, in-memory databases, and embedded replicas report `'local'`; HTTP and WebSocket clients report `'remote'`.

```ts
const observability = await storage.getStore('observability');
const location = observability?.persistenceLocation;
```

Upgrade this adapter alongside `@mastra/observability` to prevent local observability writes on Platform, even when storage export is explicitly retained.
