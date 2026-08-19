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

Workflow state updates now support an optional expectedStatus guard, so a status change is only applied when the stored run is in an expected state. This is what makes concurrent workflow resumes safe.
