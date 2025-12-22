---
"@mastra/mcp": patch
---

This adds support for the MCP Roots capability, allowing clients to expose filesystem roots to MCP servers like `@modelcontextprotocol/server-filesystem`.

**New Features:**
- Added `roots` option to server configuration for specifying allowed directories
- Client automatically advertises `roots` capability when roots are configured
- Client handles `roots/list` requests from servers per MCP spec
- Added `client.roots` getter to access configured roots
- Added `client.setRoots()` to dynamically update roots
- Added `client.sendRootsListChanged()` to notify servers of root changes

**Usage:**
```typescript
const client = new MCPClient({
  servers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      roots: [
        { uri: 'file:///tmp', name: 'Temp Directory' },
        { uri: 'file:///home/user/projects', name: 'Projects' },
      ],
    },
  },
});
```

Before this fix, the filesystem server would log:
> "Client does not support MCP Roots, using allowed directories set from server args"

After this fix, the server properly receives roots from the client:
> "Updated allowed directories from MCP roots: 2 valid directories"
