---
'@mastra/pg': patch
---

Improved PgVector upsert performance when writing many vectors at once. Batches are now written with a small number of multi-row inserts instead of one insert per vector, which reduces database round trips and connection pool usage during RAG and memory ingestion.
