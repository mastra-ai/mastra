---
'@mastra/mcp': minor
---

Added Mastra-storage-backed tasks to `MCPServer` (experimental). A server registered on a Mastra instance with background tasks enabled now keeps its tasks in Mastra storage, so any instance sharing that storage can answer `tasks/get`, `tasks/update` and `tasks/cancel` and run the task. Answers survive the instance that took them, and expired tasks are failed. Closes #28337.

Added the `recover` task option. When the server running a task stops, the task fails as lost by default; with `recover: true` another instance runs the tool again from the start. Only enable it for tools that are safe to repeat.

```typescript
const server = new MCPServer({
  id: 'reports',
  name: 'Reports',
  version: '1.0.0',
  tools: { buildReport },
  tasks: { tools: { buildReport: { mode: 'always', recover: true } } },
});

export const mastra = new Mastra({
  storage,
  backgroundTasks: { enabled: true },
  mcpServers: { reports: server },
});
```
