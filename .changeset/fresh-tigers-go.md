---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/memory': patch
'@mastra/dynamodb': patch
'@mastra/oracledb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Storage adapters now declare support for partial thread updates, letting newer @mastra/memory preserve existing thread titles instead of overwriting them, while remaining safe against older versions.
