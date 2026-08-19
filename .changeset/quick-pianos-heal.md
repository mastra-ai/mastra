---
'@mastra/server': patch
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

Resume conflicts now return 409 Conflict. When a suspended workflow run has already been resumed by another caller, the resume endpoints respond with 409 instead of a generic error.
