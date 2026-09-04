---
'@mastra/duckdb': minor
---

Added advanced trace query support to DuckDB observability storage, including filtering, grouping, ordering, cursor pagination, shared cross-adapter semantics, and query-shape-aware relation reads.

Repeated writes for a score ID now retain the latest record so trace queries evaluate the current score consistently with other observability adapters.
