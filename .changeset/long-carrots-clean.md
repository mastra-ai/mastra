---
'@mastra/pg': minor
'@mastra/clickhouse': minor
'@mastra/duckdb': minor
---

Added support for `timeToFirstToken.*` and `timeToFirstChunk.*` measures in trace and span aggregates. Rows without a recorded value are skipped, never counted as 0.
