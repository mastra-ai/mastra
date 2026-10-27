---
'@mastra/client-js': minor
'@mastra/playground-ui': patch
'@mastra/cloudflare-d1': patch
'@mastra/cloudflare': patch
'@mastra/server': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mcp': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added `getMcpServerTasks()`, `cancelMcpServerTask()` and `answerMcpServerTaskInput()` for a MCP server's tasks.

```ts
const { tasks } = await client.getMcpServerTasks('reports');
await client.answerMcpServerTaskInput('reports', tasks[0].taskKey, {
  approve: { action: 'accept', content: { ok: true } },
});
```
