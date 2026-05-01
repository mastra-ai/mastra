---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

MCP Apps extension — Studio and SDK integration:

- `@mastra/playground-ui`: McpAppViewer component now uses standard `@mcp-ui/client` AppRenderer for sandboxed iframe rendering with full JSON-RPC postMessage protocol.
- `@mastra/client-js`: Added `getMcpServerResources()` and `readMcpServerResource()` methods to MastraClient for listing and reading MCP server resources.
- `@mastra/editor`: Updated MCP tool info schema to include optional `_meta` field.
- `@mastra/server`: Added authenticated API endpoints for listing (`GET /mcp/:serverId/resources`) and reading (`POST /mcp/:serverId/resources/read`) MCP server resources.
- `@mastra/core`: Added abstract `listResources()` and `readResource()` methods to MCPServerBase.
- `@mastra/mcp`: Added MCPClientServerProxy for proxying external MCP servers into Studio, and `toMCPServerProxies()` convenience method on MCPClient. Tools from `listTools()` are automatically stamped with `serverId` in `_meta.ui` for resource resolution.
