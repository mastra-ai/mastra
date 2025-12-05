---
'@mastra/core': patch
'@mastra/cloudflare': patch
'@mastra/cloudflare-d1': patch
'@mastra/mongodb': patch
'@mastra/lance': patch
'@mastra/upstash': patch
'@mastra/clickhouse': patch
'@mastra/dynamodb': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/convex': patch
---

Fix saveScore not persisting ID correctly, breaking getScoreById retrieval

**What Changed**
- saveScore now correctly returns scores that can be retrieved with getScoreById
- Validation errors now include contextual information (scorer, entity, trace details) for easier debugging

**Impact**
Previously, calling getScoreById after saveScore would return null because the generated ID wasn't persisted to the database. This is now fixed across all store implementations, ensuring consistent behavior and data integrity.
