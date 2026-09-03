---
'@mastra/mcp': minor
---

Added request-scoped W3C trace metadata propagation for MCP clients. Configure a provider on a server definition:

```typescript
const client = new MCPClient({
  servers: {
    reports: {
      url: new URL('https://mcp.example.com/mcp'),
      traceContext: () => currentTraceContext,
    },
  },
});
```

The provider is resolved for every request. Explicit tool-call metadata takes precedence, and servers receive the values through `context.mcp.extra._meta`.
