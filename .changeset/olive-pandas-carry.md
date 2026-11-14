---
'@mastra/mcp': minor
---

`MCPServer` accepts a `maxRequestBodySize` option, so HTTP requests larger than the 4 MiB default are no longer answered with a `413` before the tool runs.

```typescript
// Before: a tools/call body over 4 MiB was rejected
// { "code": -32000, "message": "Payload Too Large: Request body must not exceed 4194304 bytes" }

// After: raise the limit for the servers that need it
const server = new MCPServer({
  name: 'intake',
  version: '1.0.0',
  maxRequestBodySize: 16 * 1024 * 1024,
  tools: { submitIntake },
});
```

The bound is in bytes and must be positive. Leaving it unset keeps the SDK default of `4194304` (4 MiB), and a body over the limit is still rejected with a `413` JSON-RPC error before it is parsed. It applies to `startHTTP` requests only; `stdio` has no request bodies.