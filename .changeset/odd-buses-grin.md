---
'@mastra/duckdb': minor
---

Added bounded trace-query field and value discovery for DuckDB observability storage.

```ts
const observability = await storage.getStore('observability');
const fields = await observability?.getTraceQueryObservedFields(fieldsPlan);
const values = await observability?.getTraceQueryValues(valuesPlan);
```
