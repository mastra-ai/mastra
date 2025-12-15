---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
'mastra': patch
'create-mastra': patch
---

Add delete workflow run API

```typescript
await workflow.deleteWorkflowRunById(runId)
```
