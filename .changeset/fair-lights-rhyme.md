---
'@mastra/cloudflare-d1': major
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/dynamodb': major
'@mastra/mongodb': major
'@mastra/upstash': major
'@mastra/core': major
'@mastra/libsql': major
'@mastra/lance': major
'@mastra/mssql': major
'@mastra/pg': major
---

Add new list methods to storage API: `listMessages`, `listMessagesById`, `listThreadsByResourceId`, and `listWorkflowRuns`. Most methods are currently wrappers around existing methods. Full implementations will be added when migrating away from legacy methods.
