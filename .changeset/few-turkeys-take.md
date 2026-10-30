---
'@mastra/pg': patch
---

Fixed `PgVector.query()` ignoring HNSW indexes whenever a metadata filter or `minScore` was set ([#28949](https://github.com/mastra-ai/mastra/issues/28949)). Memory recall always filters by resource or thread, so it scanned and sorted every matching row on each search. On pgvector 0.8.0 or newer, filtered searches on HNSW indexes can now use the index. If the index search finds fewer than `topK` rows, which can happen for resources with few rows, the query falls back to an exact search, so results are never silently dropped. IVFFlat indexes still use the exact search.
