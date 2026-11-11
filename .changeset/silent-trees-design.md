---
'@mastra/duckdb': minor
---

Added `persistenceLocation: 'local'` to DuckDB observability storage, including its lazy facade and direct implementation.

```ts
const observability = await storage.getStore('observability');
const location = observability?.persistenceLocation; // 'local'
```

Upgrade this adapter alongside `@mastra/observability` to prevent local observability writes on Platform, even when storage export is explicitly retained.
