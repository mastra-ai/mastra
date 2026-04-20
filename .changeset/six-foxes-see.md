---
'@mastra/libsql': minor
---

Use DiskANN vector_top_k() index for faster vector queries when available

LibSQLVector.query() now automatically uses the existing DiskANN index for approximate nearest neighbor search instead of brute-force full table scans, providing 10-25x query speedups on larger datasets. Falls back to brute-force when no index exists.
