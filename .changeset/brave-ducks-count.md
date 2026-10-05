---
'@mastra/duckdb': patch
---

Added token and cost measures to `aggregateTraces()` in the DuckDB observability store. Requests can now use `tokens.input`, `tokens.output`, `tokens.total`, `tokens.reasoning`, and `tokens.cached` (`.sum` / `.avg`) plus `cost.sum` / `cost.avg`, and rows for cost requests include `cost: { coverage, unit }`. Usage is read from model token metrics for each trace, so retried metric writes count once (including in tables created before the signal migration), and spend recorded after the window ends still counts for traces that started inside it.
