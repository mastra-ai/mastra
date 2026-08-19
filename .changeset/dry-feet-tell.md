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

Fixed concurrent resume() calls on the same suspended workflow run executing downstream steps more than once. A resume now atomically claims the run before executing anything, so only one caller continues a given suspension. Losing callers throw WORKFLOW_RESUME_ALREADY_CLAIMED without running any steps. Fixes #20443
