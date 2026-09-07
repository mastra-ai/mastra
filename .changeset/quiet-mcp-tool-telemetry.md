---
'@mastra/core': patch
'@mastra/otel-exporter': patch
'@mastra/arize': patch
---

Preserve MCP tool descriptions and types in OpenTelemetry spans. Export MCP server names and optional versions as `mastra.mcp_tool_call.server_name` and `mastra.mcp_tool_call.server_version`, retaining `server.address` and preserving server metadata through Arize's OpenInference conversion.
