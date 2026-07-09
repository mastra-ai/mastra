---
'@mastra/clickhouse': minor
---

Added legacy-to-VNext span migration for ClickHouse observability storage. Customers using `ObservabilityStorageClickhouse` (legacy) can now run `npx mastra migrate` to copy historical spans from `mastra_ai_spans` to the VNext `mastra_span_events` schema. The migration handles column mapping, batches by day for memory safety, deduplicates legacy rows, converts empty-string parentSpanId to NULL for correct root span detection, and supports both old (`Nullable(String)` JSON) and new (`Array(String)`) tags schemas. The legacy table is preserved as a backup after migration.
