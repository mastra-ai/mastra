---
'@mastra/pg': minor
---

Added trace-query tag predicates for PostgreSQL. Trace queries can use `includes`, `notIncludes`, `exists`, and `notExists` on `tags`, and value discovery returns each observed tag with the number of traces that carry it. Tag membership uses the existing GIN index on `tags`.
