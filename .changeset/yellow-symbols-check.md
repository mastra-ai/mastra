---
'@mastra/deployer': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

allows ability to pass McpServer into the mastra class and creates an endpoint /api/servers/:serverId/mcp to POST messages to an MCP server
