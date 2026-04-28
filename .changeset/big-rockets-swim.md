---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/memory': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/redis': patch
'@mastra/pg': patch
---

Fixed legacy message compatibility fields so memory history and provider retry processors keep working when stored messages derive those fields from parts.
