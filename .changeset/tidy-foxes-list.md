---
'@mastra/pg': patch
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
---

The observability stores used by `PostgresStoreVNext`, `ClickhouseStoreVNext` and `DuckDBStore` now declare their filter discovery support, so Studio can show discovery-backed filters based on what the store reports.

```ts
const { capabilities } = await client.getObservabilityCapabilities();
capabilities.discovery; // { entityTypes: true, entityNames: true, serviceNames: true, environments: true, tags: true, metrics: true }
```
