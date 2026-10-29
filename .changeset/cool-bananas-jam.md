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

Fixed a late background task write overwriting a newer suspension. A write meant for an earlier suspension of a task is now rejected instead of replacing the later one. The adapter supports the new `expectedSuspendedAt` update condition.
