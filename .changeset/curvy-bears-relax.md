---
'@mastra/mcp': minor
---

MCPClient: expose connected client resources.

Added a new `getResources()` method to the MCPClient class that allows clients to retrieve resources from connected MCP servers. Resources are data or content exposed by MCP servers that can be accessed by clients.

The implementation includes:
- Direct access to resources from all connected MCP servers, grouped by server name
- Robust error handling that allows partial results when some servers fail
- Comprehensive test coverage with real server implementation

This feature enables applications to access data and content exposed by MCP servers through the resources capability, such as files, databases, or other content sources.
