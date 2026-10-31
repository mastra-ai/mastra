---
'@mastra/code-sdk': patch
---

Fixed one stalled MCP server keeping every MCP server stuck on "connecting...". Each server now connects and reports its status and tools on its own, so healthy servers show as connected as soon as they are ready. A server that has not connected and listed its tools within 60 seconds is reported as failed with a timeout error, and switches to connected automatically if it finishes later (for example after a slow first-run `npx` install). Reconnecting a server from `/mcp` uses the same 60-second limit and no longer waits on other servers. Retrying a timed-out server or reconnecting one server no longer starts the other servers again, so a server that failed on start isn't relaunched (or asked to sign in again) each time.

To change the limit, pass `discoveryTimeoutMs` to `createMcpManager()`:

```ts
const manager = createMcpManager(projectDir, undefined, undefined, undefined, {
  discoveryTimeoutMs: 120_000,
});
```
