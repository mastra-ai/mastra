---
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mssql': patch
'@mastra/mongodb': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/dynamodb': patch
'@mastra/lance': patch
---

Add `BackgroundTasksStorage` domain implementation so `@mastra/core` background task execution works with any storage adapter.
