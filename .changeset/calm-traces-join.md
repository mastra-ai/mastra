---
'@mastra/mcp': minor
---

Linked MCP calls across traces, in both directions. When an agent or workflow calls a tool through `MCPClient`, the request carries the W3C `traceparent` of the tool call span. `MCPServer` keeps its own trace for the request and records a link to that span. Its reply names the span that served the call, and `MCPClient` links the tool call span back to it, so you can move between the two traces from either side.

The server reads `traceparent` from the request `_meta`, or from the HTTP `traceparent` header that OpenTelemetry-instrumented callers send, and returns its own span only to callers that sent trace context. Both traces keep their own root span and summary, so exporters show them as before.
