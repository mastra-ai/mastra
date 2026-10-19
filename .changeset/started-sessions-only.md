---
'@mastra/server': minor
'@mastra/core': patch
'@mastra/factory': patch
---

Agent controller session routes no longer start a session as a side effect. Only `POST /agent-controller/:controllerId/sessions` starts one. Before, a message, model switch or state write that reached the server first created the session on a new random thread. The write then landed on a thread the client never read, so it looked lost.

Every other session route now acts on a started session. After a server restart it rebuilds the session from its stored thread. If the session was never started, the route returns `404` and creates nothing.

```ts
const session = client.getAgentController('code').session(resourceId);
await session.create({ threadId }); // start first
await session.sendMessage('Hello'); // 404 if the session was never started
```

`AgentController.createSession` accepts `resumeOnly: true` to get this behavior. It throws `SessionNotStartedError` when no stored thread matches. Factory now starts the session on its own thread when the session is created, so the first prompt can be sent right away.
