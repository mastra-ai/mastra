---
'@mastra/client-js': minor
---

Added `agent.browserSession(threadId?)` to the `Agent` resource and a corresponding `GetAgentBrowserSessionResponse` type. Use it to probe the server's browser session state before opening a screencast WebSocket, so the connection is only made when the server has screencast support installed and an active session exists for the thread.

```ts
const probe = await client.getAgent('my-agent').browserSession(threadId);
if (probe.screencastAvailable && probe.hasSession) {
  // safe to open the screencast WebSocket
}
```
