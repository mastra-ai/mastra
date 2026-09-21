---
'@mastra/duckdb': minor
'@mastra/pg': minor
'@mastra/clickhouse': minor
---

Executed trace-query tag predicates (`includes`, `notIncludes`, `exists`, `notExists` on `tags`) and tag value discovery with per-trace counts. Missing and empty tag lists behave the same across all three stores.
