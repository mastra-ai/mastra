---
"@mastra/mcp": patch
---

Fix MCPServer regular tools missing requestContext populated from mcp.extra

Regular tools executed via CallToolRequestSchema now receive requestContext
populated from mcp.extra, consistent with agent tools and workflow tools.
