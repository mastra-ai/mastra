---
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Support the `expectedSuspendedAt` background task update condition, so a write meant for an earlier suspension of a task is rejected instead of overwriting a later one.
