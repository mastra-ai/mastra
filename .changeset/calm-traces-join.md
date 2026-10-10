---
'@mastra/mcp': minor
---

Linked MCP calls across traces, in both directions. When an agent or workflow calls a tool through `MCPClient`, the request carries the W3C `traceparent` of the tool call span. `MCPServer` keeps its own trace for the request and links its request span to that span. Its `tools/call` reply names the span that served the call, and `MCPClient` links the tool call span back to it, so you can move between the two traces from either side. When the server uses a tracing bridge and its HTTP instrumentation continues the caller's trace, the request joins that trace instead.

The server reads `traceparent` and `tracestate` from the request `_meta`, or from the HTTP headers that OpenTelemetry-instrumented callers send. It also records them on the request span as `callerTraceparent` and `callerTracestate`, so exporters without span link support still show the caller.

This needs no setup. To send your own trace context, or none, set `traceContext` on the server:

```ts
const mcp = new MCPClient({
  servers: {
    orders: {
      url: new URL('https://orders.example.com/mcp'),
      traceContext: () => undefined, // send no trace context
    },
  },
});
```

`@mastra/mcp` now requires `@mastra/core` 1.76.0 or later.
