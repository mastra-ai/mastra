---
'@mastra/duckdb': minor
---

Added trace-query tag predicates for DuckDB. Trace queries can use `includes`, `notIncludes`, `exists`, and `notExists` on `tags`, and value discovery returns each observed tag with the number of traces that carry it. Missing and empty tag lists behave the same.
