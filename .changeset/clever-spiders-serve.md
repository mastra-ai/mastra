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

Standardize saveScore across all stores:
- Use SaveScorePayload type instead of Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>
- Use crypto.randomUUID() consistently for ID generation
- Use VALIDATION_FAILED error status consistently
- Include verbose error details (scorer, entityId, entityType, traceId, spanId)
