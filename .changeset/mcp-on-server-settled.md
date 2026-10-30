---
'@mastra/mcp': minor
---

Added an `onServerSettled` option to `listToolsWithErrors()`, `listToolsetsWithErrors()`, and `listToolDefinitionsWithErrors()`. It is called for each server as soon as that server's discovery succeeds, fails, or times out, so you can show healthy servers right away instead of waiting for the slowest one.

```ts
await mcp.listToolsetsWithErrors({
  perServerTimeoutMs: 60_000,
  onServerSettled: (serverName, { value, error, duration }) => {
    console.log(serverName, error ? error.message : Object.keys(value), duration);
  },
});
```
