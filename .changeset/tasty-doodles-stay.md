---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/duckdb': minor
---

Added an optional `persistenceLocation` capability to observability storage domains so exporters can distinguish local storage from remote databases. libSQL reports local files, in-memory databases, and embedded replicas as local; HTTP and WebSocket clients report remote storage. DuckDB reports local storage through both its facade and direct domain implementation.

```ts
const observability = await storage.getStore('observability');
const location = observability?.persistenceLocation; // 'local', 'remote', or undefined
```

Adapters that do not report a location remain compatible. Upgrade the libSQL or DuckDB adapter alongside `@mastra/observability` to enable the local-storage guard on Platform.
