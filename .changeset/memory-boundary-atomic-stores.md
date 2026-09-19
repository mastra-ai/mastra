---
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mssql': patch
'@mastra/oracledb': patch
'@mastra/cloudflare-d1': patch
'@mastra/convex': patch
'@mastra/dsql': patch
'@mastra/spanner': patch
'@mastra/mongodb': patch
'@mastra/dynamodb': patch
'@mastra/elasticsearch': patch
'@mastra/redis': patch
'@mastra/valkey': patch
'@mastra/upstash': patch
'@mastra/lance': patch
---

Improved `messageHistory` trim boundaries to persist atomically when multiple app instances share one database. A stale instance can no longer overwrite a newer boundary, so trimmed history stays excluded from later turns.
