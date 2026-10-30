---
'@mastra/pg': patch
---

Fixed `PgVector.query()` skipping HNSW indexes when a filter or `minScore` was set ([#28949](https://github.com/mastra-ai/mastra/issues/28949)). On pgvector 0.8.0 or newer, these searches now use the index, which speeds up memory recall. Like unfiltered HNSW searches, the results are approximate and can differ slightly from an exact search. If the index finds fewer than `topK` rows, the query reruns as an exact search. IVFFlat indexes still use the exact search.
