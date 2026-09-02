---
'@mastra/mcp': major
---

Changed omitted MCP protocol configuration to prefer MCP 2026-07-28.

**Before**

Omitting `protocolVersion` selected the legacy 2025 connection and server behavior.

```typescript
const client = new MCPClient({
  servers: { remote: { url: new URL('https://example.com/mcp') } },
})

const server = new MCPServer({ name: 'Tools', version: '1.0.0', tools })
```

**After**

Omitted client configuration uses automatic negotiation. Omitted server configuration uses the modern stateless handler. Pin either side to keep legacy behavior:

```typescript
const client = new MCPClient({
  servers: {
    remote: {
      url: new URL('https://example.com/mcp'),
      protocolVersion: '2025-11-25',
    },
  },
})

const server = new MCPServer({
  name: 'Tools',
  version: '1.0.0',
  tools,
  protocolVersion: '2025-11-25',
})
```

This default enables stateless requests, modern subscriptions, multi round-trip elicitation, JSON Schema 2020-12 results, and request metadata on compatible connections. Explicit legacy support remains available for session-dependent integrations and deprecated protocol features.
