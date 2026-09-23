---
'@mastra/mcp': minor
---

Carry the MCP tool `title` through `MCPClient` and `MCPServer`. Closes #20249.

- `MCPServer` publishes a tool's `title` in `tools/list`. Tools that only set `mcp.annotations.title` are unchanged.
- Tools returned by `MCPClient` carry `tool.title`, taken from the server's tool `title` and falling back to `annotations.title`, the same precedence MCP clients use for display names.
- `listToolDefinitions()` keeps the title and `toolFromDefinition()` restores it.

```ts
const tools = await mcp.listTools();
tools.github_create_issue.title; // 'Create Issue'
```
