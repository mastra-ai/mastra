---
'@mastra/core': patch
---

Fix in-memory observability storage to match the contract validated against DuckDB/ClickHouse vNext adapters.

Previously, when running Mastra with the default in-memory storage, several observability operations behaved differently than they would against a production database:

- **`getSpans`** threw 'This storage provider does not support batch-fetching spans'. It now batch-fetches spans by id within a trace, enabling the optimized `getBranch` path on in-memory storage.
- **`batchCreateLogs`, `batchCreateMetrics`, `createScore`/`batchCreateScores`, `createFeedback`/`batchCreateFeedback`** appended duplicate records on retry. They now upsert by id, preserving the cursor id so delta polling does not re-emit the record. This makes client retries safe.
- **Discovery operations** (`getEntityTypes`, `getEntityNames`, `getServiceNames`, `getEnvironments`, `getTags`) only inspected spans. They now also scan logs and metrics, so dimensions emitted on those surfaces are surfaced in discovery results.
- **`getMetricTimeSeries`** merged grouped series whose label values contained the `|` character (e.g. `{segmentA: 'a', segmentB: 'b|c'}` collided with `{segmentA: 'a|b', segmentB: 'c'}`). Series are now keyed on the original label tuple, so colliding display names remain distinct series.
