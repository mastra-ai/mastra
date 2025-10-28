---
'@mastra/core': patch
'@mastra/mcp': patch
---

Breaking change to move mcp related tool execute arguments nested under an `mcp` argument that is only populated if the tool is passed to an MCPServer. This simpliflies tool definitions and gives you the correct types when working with tools meant for MCP servers.
