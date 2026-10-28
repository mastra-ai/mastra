---
'@mastra/clickhouse': patch
'@mastra/duckdb': patch
'@mastra/pg': patch
---

Thread rows from `queryThreads()` no longer include `model` or `provider`, and the store no longer runs the per-page model lookup, so thread pages load faster. Requires `@mastra/core` 1.80.0 or later.
