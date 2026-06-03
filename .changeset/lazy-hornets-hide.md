---
'@mastra/mcp': minor
'@mastra/core': minor
---

Added MCP server Fine-Grained Authorization mapping overrides for tool authorization.

Use the new `fga` option on `MCPServer` to customize the resource and permission mappings used for `tools/list` and `tools/call` checks without changing the Mastra instance-level `tool` mapping used by internal agent and workflow tool execution.

```ts
const server = new MCPServer({
  name: 'My Server',
  version: '1.0.0',
  tools: { getData },
  fga: {
    resourceMapping: {
      tool: {
        fgaResourceType: 'user',
        deriveId: ({ user }) => user.id,
      },
    },
    permissionMapping: {
      'tools:execute': 'read',
    },
  },
});
```
