---
'@mastra/client-js': minor
---

Added `getMcpServerTasks()`, `findMcpServerTask()`, `cancelMcpServerTask()` and `answerMcpServerTaskInput()` for a MCP server's tasks.

```ts
const { tasks, nextCursor } = await client.getMcpServerTasks('reports', { status: 'input_required' });
await client.answerMcpServerTaskInput('reports', tasks[0].taskKey, {
  approve: { action: 'accept', content: { ok: true } },
});
```
