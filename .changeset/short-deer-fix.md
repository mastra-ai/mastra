---
'@mastra/deployer': patch
'@mastra/core': patch
---

Fixed `mcpOptions` (including `serverless: true`) being silently ignored when using the Mastra deployer. The deployer now forwards `mcpOptions` from your server config to the underlying `MastraServer`, so MCP stateless mode works correctly in serverless environments like Cloudflare Workers, Vercel Edge, and AWS Lambda. ([#14810](https://github.com/mastra-ai/mastra/issues/14810))

**What changed:**

- Added `mcpOptions` to the `ServerConfig` type so it can be set in `new Mastra({ server: { ... } })`
- The deployer now passes `server.mcpOptions` through to `MastraServer`

**Example:**

```typescript
const mastra = new Mastra({
  server: {
    mcpOptions: {
      serverless: true,
    },
  },
});
```
