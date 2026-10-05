---
'@mastra/pg': patch
---

Fixed HNSW vector queries on pgvector versions before 0.8.0. On Postgres 15 or later, these queries failed with `invalid configuration parameter name "hnsw.iterative_scan"`. The query now sets `hnsw.iterative_scan` only on pgvector 0.8.0 or later. On older versions, HNSW queries work as they did before `@mastra/pg@1.22.0`.
