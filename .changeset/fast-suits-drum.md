---
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Added multi-tenant score filtering to the storage adapters. The `listScoresBy*` methods now accept a `filters` option to scope results by `organizationId` and `projectId`, and saved scores persist these tenancy fields.
