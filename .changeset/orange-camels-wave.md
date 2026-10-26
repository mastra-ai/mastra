---
'@mastra/mcp': minor
---

Added experimental support for answering tool calls with MCP Tasks (`io.modelcontextprotocol/tasks`). A long-running tool can now hand the client a task right away; the client polls for the result, so the work isn't limited by HTTP timeouts. Clients that don't support tasks keep getting normal answers.

```typescript
const server = new MCPServer({
  name: 'Reports',
  version: '1.0.0',
  tools: { buildReport, lookupCustomer },
  tasks: {
    tools: {
      buildReport: 'always',
      lookupCustomer: { mode: 'auto', syncWindowMs: 1000 },
    },
  },
});
```

Tasks are bound to the caller that created them, can be cancelled (which aborts the tool's `abortSignal`), and expire after 24 hours by default. A tool that calls `suspend()` inside a task asks the client for input, and runs again with `resumeData` once the client answers. Tasks are kept in memory by default; pass `tasks.store` to keep them elsewhere.

Task runs use the request context stored when the task was created, with the bearer token removed, and get no `context.mcp`. The only exception is the first run of an `'auto'` tool, which started under the request. Read cancellation from `context.abortSignal`.
