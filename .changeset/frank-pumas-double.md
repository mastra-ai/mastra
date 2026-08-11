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
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Fixed a crash where updating a thread without a title (for example during observational memory buffering) could write a null title and violate the database's not-null constraint when running a newer @mastra/memory against an older storage package. Memory now checks whether the connected storage adapter supports partial thread updates and backfills the existing title for older adapters, so mixed-version deployments keep working. See #21041 for the original title-clobbering fix this makes backward compatible.
