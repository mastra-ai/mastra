---
'@mastra/libsql': patch
---

Fixed slow `LibSQLVector.query()` calls when the vector index is not used, such as with in-memory databases, tables without a vector index, or filtered queries that fall back to a full scan. The query vector is now parsed once per query instead of once for every scanned row, so these queries are much faster on large or high-dimensional tables and return the same results.
