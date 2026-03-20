---
'@mastra/mcp': patch
---

Fixed MCP tool results to preserve the standard CallToolResult envelope shape. Previously, content was extracted from the envelope which broke consumers expecting the standard MCP result format. Output schema validation is now handled internally by the MCP SDK's AJV validator instead of Zod, preventing unrecognized keys from being stripped.
