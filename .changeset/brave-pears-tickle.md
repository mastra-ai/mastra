---
'@mastra/clickhouse': minor
---

Added schema-neutral advanced trace-query execution over ClickHouse's existing completion-only observability tables.

Trace queries read from the historical-complete root table, deduplicate completed deliveries by the existing `dedupeKey`, reconstruct each referenced relation once within the bounded root scope, fail closed on unsupported order fields, and enforce a configurable 15-second execution timeout. This feature requires no schema, table-engine, or data migration.
