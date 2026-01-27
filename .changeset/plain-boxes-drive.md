---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Added `mcpOptions` to server adapters for serverless MCP support.

**Why:** MCP HTTP transport uses session management by default, which requires persistent state across requests. This doesn't work in serverless environments like Cloudflare Workers or Vercel Edge where each request runs in isolation. The new `mcpOptions` parameter lets you enable stateless mode without overriding the entire `sendResponse()` method.

**Before:**

```typescript
const server = new MastraServer({
  app,
  mastra,
});
// No way to pass serverless option to MCP HTTP transport
```

**After:**

```typescript
const server = new MastraServer({
  app,
  mastra,
  mcpOptions: {
    serverless: true,
  },
});
// MCP HTTP transport now runs in stateless mode
```
