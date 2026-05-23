---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground-ui': minor
'@mastra/duckdb': minor
'@mastra/clickhouse': minor
---

Added observability storage capabilities so applications can inspect log, metric, and persistence support without probing storage methods.

```ts
const capabilities = mastra.getStorage()?.stores?.observability?.getCapabilities();

if (capabilities?.metrics.aggregate === true) {
  // The configured observability store supports metrics aggregation.
}
```
