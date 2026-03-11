---
'mastracode': minor
---

Added `mcpServers` option to `createMastraCode()` for programmatic MCP server configuration. Servers passed via this option are merged with file-based configs at highest priority, allowing you to define MCP servers directly in code:

```typescript
const { harness } = await createMastraCode({
  mcpServers: {
    filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'] },
    remote: { url: 'https://mcp.example.com/sse', headers: { Authorization: 'Bearer tok' } },
  },
})
```

