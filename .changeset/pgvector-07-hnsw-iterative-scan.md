---
'@mastra/pg': patch
---

Fixed `PgVector.query()` failing on HNSW indexes with `invalid configuration parameter name "hnsw.iterative_scan"` when running pgvector 0.7.x (or older) on Postgres 15 or later. The `hnsw.iterative_scan` setting is now applied only when the detected pgvector version is 0.8.0 or later; on older versions HNSW queries run without it, as they did before `@mastra/pg@1.22.0`.
