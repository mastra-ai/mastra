---
'@mastra/mcp': minor
---

Added `registerProcessHooks: false` to `MCPClient` so applications can finish graceful shutdown and call `disconnect()` themselves. The default remains `true`. Fixes [#27478](https://github.com/mastra-ai/mastra/issues/27478).

```ts
const mcp = new MCPClient({
  servers: { weather: { url: new URL('https://example.com/mcp') } },
  registerProcessHooks: false,
});

process.once('SIGTERM', async () => {
  await mcp.disconnect();
  process.exit(0);
});
```
