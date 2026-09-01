---
'@mastra/duckdb': minor
---

Added advanced trace query support to DuckDB observability storage, including filtering, grouping, ordering, and cursor pagination.

Repeated writes for a score ID now retain the latest record so trace queries evaluate the current score consistently with other observability adapters.
