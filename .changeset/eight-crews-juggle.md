---
'@mastra/mcp': minor
---

Added Mastra-storage-backed tasks to `MCPServer` (experimental). Closes #28337.

- **Shared tasks.** A server registered on a Mastra instance with background tasks enabled keeps its tasks in Mastra storage. Any instance that shares the storage can check, answer, cancel, and run a task.
- **Survives restarts.** Answers outlive the instance that took them. Each instance picks up tasks left by stopped instances as soon as the server is registered.
- **Cleans up after itself.** Expired tasks fail, and finished tasks are deleted when their TTL ends.
- **Limits apply everywhere.** `maxOpenTasksPerClient` and `maxOpenTasks` count tasks across all instances.
- **Private by default.** Storage never keeps task ids or bearer tokens. A readable `metadata.clientLabel` shows which client sent a task.
- **One trace per task.** The call that creates a task, each run of the tool, and later answers and cancels share one trace. Polls aren't traced.
- **Opt-in recovery.** When the instance running a task stops, the task fails by default. Set `recover: true` to run the tool again on another instance. Only use it for tools that are safe to repeat.

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
