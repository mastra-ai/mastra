---
'@mastra/otel-exporter': patch
'@mastra/playground-ui': patch
'@mastra/laminar': patch
'@mastra/core': patch
'@mastra/mcp': patch
---

Exported `MCP_SERVER_REQUEST` spans with `SpanKind.SERVER` and `mcp.method.name` / `mcp.protocol.version` attributes.
