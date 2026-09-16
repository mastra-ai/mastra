---
'@mastra/core': minor
'@mastra/otel-exporter': patch
'@mastra/playground-ui': patch
'@mastra/laminar': patch
'@mastra/mcp': patch
---

Added the `MCP_SERVER_REQUEST` span type, `MCPServerRequestAttributes`, and `EntityType.MCP_SERVER` for requests served by a Mastra `MCPServer`. Added a `skipToolSpan` tool execution option so a caller that already owns a span can run a tool without an extra `TOOL_CALL` span. See https://github.com/mastra-ai/mastra/issues/23921
