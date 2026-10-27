---
'@mastra/client-js': minor
---

Added `getMcpServerTasks()`, `cancelMcpServerTask()` and `answerMcpServerTaskInput()` for a MCP server's tasks.

```ts
const { tasks } = await client.getMcpServerTasks('reports');
await client.answerMcpServerTaskInput('reports', tasks[0].taskKey, {
  approve: { action: 'accept', content: { ok: true } },
});
```
