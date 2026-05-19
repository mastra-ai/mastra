---
'@mastra/client-js': minor
---

Added `agent.browserSession(threadId?)` and `agent.closeBrowser(threadId?)` to the `Agent` resource, plus a `GetAgentBrowserSessionResponse` type.

`browserSession` probes the server's browser session state before opening a screencast WebSocket, so the connection is only made when the server has screencast support installed and an active session exists for the thread. `closeBrowser` ends the agent's browser session (or a single thread's session if `threadId` is passed). Both methods go through the configured client `baseUrl` and `apiPrefix`, so they work with servers mounted under a non-default API prefix.

```ts
const probe = await client.getAgent('my-agent').browserSession(threadId);
if (probe.screencastAvailable && probe.hasSession) {
  // safe to open the screencast WebSocket
}

await client.getAgent('my-agent').closeBrowser(threadId);
```
