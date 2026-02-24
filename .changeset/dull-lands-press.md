---
'@mastra/mcp': patch
---

Fixed MCP tool results returning empty `{}` when the server does not include `structuredContent` in responses (e.g. FastMCP, older MCP protocol versions). The client now extracts the actual result from the `content` array instead of returning the raw protocol envelope, which previously caused output schema validation to strip all properties.
