---
'@mastra/cloudflare-d1': patch
'@mastra/deployer': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/inngest': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Add restart method to workflow run that allows restarting an active workflow run
Add status filter to `listWorkflowRuns`
Add automatic restart to restart active workflow runs when server starts
