---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

Fixed MCP resource reads dropping `mimeType` and `_meta`. Reading a resource from a server registered through `MCPClient` (`MCPClientServerProxy.readResource()`) and reading an app resource from a local `MCPServer` (`MCPServer.readResource()`, used by Studio) now return the same metadata as `listResources()` and the MCP `resources/read` request, so MCP App `ui://` resources keep their content type and UI settings such as CSP. Fixes #23068.
