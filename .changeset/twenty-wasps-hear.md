---
'@mastra/playground-ui': minor
---

Added a chip to tool-call cards for calls that continue as MCP tasks. It shows the task's status and elapsed time, with a button to copy the MCP task id. The chip appears for MCP servers the client accepts tasks from:

```ts
const mcpClient = new MCPClient({
  servers: {
    reports: { url: new URL('https://reports.example.com/mcp'), tasks: {} },
  },
});
```
