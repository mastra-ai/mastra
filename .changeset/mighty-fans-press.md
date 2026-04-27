---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mongodb': patch
'@mastra/mssql': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/convex': patch
'@mastra/dynamodb': patch
'@mastra/lance': patch
'@mastra/redis': patch
'@mastra/upstash': patch
---

Reduced stored memory message size by deriving legacy AI SDK v4 fields from message parts instead of saving duplicate data.
