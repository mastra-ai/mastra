---
'@mastra/elasticsearch': patch
'@mastra/dynamodb': patch
'@mastra/oracledb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/valkey': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Reduced storage used by agent runs waiting on tool approval or a suspended tool. Each suspended snapshot now stores the conversation one fewer time, cutting snapshot size by about 29% in a 12-approval run. Suspended runs resume exactly as before.
