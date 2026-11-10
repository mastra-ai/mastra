---
'@mastra/mcp-apps-components': minor
---

Added the trace viewer MCP App, which draws a trace with Studio's timeline and opens each span's details. Import it from `@mastra/mcp-apps-components/trace-viewer` and register it under a `ui://` URI in `MCPServer`'s `appResources`. Apps now also report the package's version to the host when they connect.
