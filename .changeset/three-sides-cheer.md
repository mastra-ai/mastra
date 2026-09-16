---
'@mastra/clickhouse': minor
---

Added bounded trace-query field and value discovery for ClickHouse observability storage.

```ts
const observability = await storage.getStore('observability');
const fields = await observability?.getTraceQueryObservedFields(fieldsPlan);
const values = await observability?.getTraceQueryValues(valuesPlan);
```
