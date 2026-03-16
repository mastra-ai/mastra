---
"@mastra/mcp": patch
---

Fixed: MCPServer regular tools now receive requestContext consistently

Previously, regular tools in MCPServer did not receive requestContext from
mcp.extra, causing inconsistent auth context access compared to agent and
workflow tools. This is now unified across all tool types.
