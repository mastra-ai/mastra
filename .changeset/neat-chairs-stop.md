---
'@mastra/pg': patch
---

Fixed vector similarity queries to leverage HNSW and IVFFlat indexes. When querying without filters on an HNSW or IVFFlat-indexed table, ORDER BY and LIMIT are now placed inside the CTE so PostgreSQL can use the index for faster approximate nearest neighbor searches instead of scanning all rows.
