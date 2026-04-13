---
'@mastra/mcp': minor
---

Added `requireToolApproval` option to MCP server configuration. Set it to `true` to require human approval for all tools on a server, or pass a function for dynamic per-tool approval logic.

```ts
const mcp = new MCPClient({
  servers: {
    github: {
      url: new URL('http://localhost:3000/mcp'),
      // Require approval for all tools
      requireToolApproval: true,
      // Or use a function for dynamic approval
      requireToolApproval: ({ toolName, args, requestContext }) => {
        if (toolName === 'list_repos') return false;
        return requestContext?.userRole !== 'admin';
      },
    },
  },
});
```

This integrates with the existing human-in-the-loop approval flow.
