---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

MCP Apps extension — Studio and SDK integration:

- `@mastra/playground-ui`: Added McpAppViewer component with sandboxed iframe rendering, JSON-RPC postMessage protocol, and MCP App bridge support.
- `@mastra/client-js`: Added `getMcpServerResources()` and `readMcpServerResource()` methods to MastraClient for listing and reading MCP server resources.
- `@mastra/editor`: Updated MCP tool info schema to include optional `_meta` field.
- `@mastra/server`: Added authenticated API endpoints for listing (`GET /mcp/:serverId/resources`) and reading (`POST /mcp/:serverId/resources/read`) MCP server resources.
- `@mastra/core`: Added abstract `listResources()` and `readResource()` methods to MCPServerBase.
- `@mastra/mcp`: Added MCPClientServerProxy for proxying external MCP servers into Studio, and `toMCPServerProxies()` convenience method on MCPClient.
