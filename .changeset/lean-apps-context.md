---
'@mastra/mcp': minor
---

Tool result `transform` functions on `MCPServer` now receive `apps` in their context. It is `true` when the calling client renders MCP Apps, so a transform can send a short text summary to the model and the full data to the app as `structuredContent`.
