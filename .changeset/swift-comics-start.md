---
'@mastra/pg': minor
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
---

Added bounded trace-query field and value discovery for PostgreSQL observability storage.

```ts
const observability = await storage.getStore('observability');
const fields = await observability?.getTraceQueryObservedFields(fieldsPlan);
const values = await observability?.getTraceQueryValues(valuesPlan);
```
