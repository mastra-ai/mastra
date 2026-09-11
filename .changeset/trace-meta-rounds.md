---
'@mastra/mcp': minor
---

Propagate W3C trace context over MCP. `MCPClient` server definitions accept a `traceContext` (`traceparent`, optional `tracestate` and `baggage`) that is sent as request `_meta` on every call, and the server exposes the received values to ordinary tools as `requestContext.get('traceContext')` and to native tools through `request.metadata`. Values are request-scoped and never used for authorization.
