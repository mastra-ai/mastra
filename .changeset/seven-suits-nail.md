---
'@mastra/mcp': minor
---

Added experimental support for MCP tasks in `MCPClient`. A server can now answer a long-running tool call with a task instead of holding the request open. Mastra waits for the task and returns its final result, so tool calls keep the same shape.

Turn it on per server:

```typescript
const mcp = new MCPClient({
  servers: {
    reports: {
      url: new URL('https://example.com/mcp'),
      tasks: { maxWaitMs: 30 * 60_000 },
      inputRequests: async ({ params }) => ({ action: 'accept', content: { ok: true } }),
    },
  },
});
```

- A task that needs input is answered through your `inputRequests` handler and sent back with `tasks/update`, without calling the tool again.
- Aborting the tool call cancels the remote task. A cancelled or failed task becomes a tool error.
- On an agent with background tasks enabled, these tools run as background tasks, so the agent keeps working while the remote task runs.
- `mcp.tasks.get`, `mcp.tasks.update` and `mcp.tasks.cancel` read, answer and cancel a task directly.

Tasks are off unless `tasks` is set, so existing servers behave as before. See https://github.com/mastra-ai/mastra/issues/26000.
