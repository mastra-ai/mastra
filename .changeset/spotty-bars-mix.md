---
'@mastra/mcp': patch
---

Fixed MCP tool results with structured output dropping the result-level `_meta` from the server's CallToolResult. The metadata (for example `_meta.ui.resourceUri`, which MCP Apps hosts use to detect and render an app) is now preserved on the returned structured result and can be read with the new `getMcpCallToolMeta` helper. The existing hidden MCP content channel is also now readable via the exported `getMcpCallToolContent` helper. Fixes https://github.com/mastra-ai/mastra/issues/21278
