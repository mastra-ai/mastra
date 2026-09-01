---
'@mastra/clickhouse': minor
---

Added portable advanced trace-query execution with merge-independent ClickHouse plans and current-row conformance.

ClickHouse observability now persists an ingestion version for spans, trace roots, trace branches, and scores so replacement selection remains stable before and after background merges, including when domain timestamps tie. Existing unversioned replacement tables require `npx mastra migrate` before initialization; additive `isPending` columns remain automatic. Trace queries use the historical-complete root table, reconstruct each referenced relation once within the bounded root scope, and enforce a configurable 15-second execution timeout.
