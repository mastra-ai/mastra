---
'@mastra/mcp-docs-server': patch
'@mastra/dane': patch
'@mastra/mcp': patch
---

We are deprecating the MastraMCPClient class in favour of using MCPClient (formerly MCPConfiguration). MCPClient can handle 1+ MCP servers, whereas MastraMCPClient can only handle a single MCP server. Rather than having two different interfaces to use when using a single MCP vs multiple, we opted to nudge people towards using the interface that is more flexible.
