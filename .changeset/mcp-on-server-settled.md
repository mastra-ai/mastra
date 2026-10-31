---
'@mastra/mcp': minor
---

Added an `onServerSettled` option to `listToolsWithErrors()`, `listToolsetsWithErrors()`, and `listToolDefinitionsWithErrors()`. It is called for each server as soon as that server's discovery succeeds, fails, or times out, so you can show healthy servers right away instead of waiting for the slowest one.

A server that hits `perServerTimeoutMs` now reports an error with `code: MCP_DISCOVERY_TIMEOUT_CODE` (exported from `@mastra/mcp`), so you can tell a slow server apart from one that failed.

Added a `serverNames` option to the same methods to discover only the named servers. Use it to retry the servers that timed out without starting every other server again.

The `onServerSettled` callback may be `async`. If it throws or rejects, the error is logged and discovery is unaffected — a rejected callback never surfaces as an unhandled rejection.

```ts
await mcp.listToolsetsWithErrors({
  perServerTimeoutMs: 60_000,
  onServerSettled: (serverName, { value, error, duration }) => {
    console.log(serverName, error ? error.message : Object.keys(value), duration);
  },
});
```
