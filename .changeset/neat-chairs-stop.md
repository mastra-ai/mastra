---
'@mastra/pg': patch
---

Fixed vector similarity queries to use HNSW and IVFFlat indexes. Moved ORDER BY and LIMIT inside the CTE so PostgreSQL can leverage vector indexes for faster approximate nearest neighbor searches instead of scanning all rows.
