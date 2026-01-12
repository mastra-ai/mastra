---
'@mastra/mcp': minor
---

Expose MCP tool annotations in listTools response (Issue #9859)
Update MCPServer listTools handler to include annotations and \_meta fields in tool listings
This enables compatibility with OpenAI Apps SDK and other MCP clients that expect tool metadata
