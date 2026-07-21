---
'@mastra/client-js': minor
---

Added a `requestContext` option to agent controller session methods in @mastra/client-js. You can now pass custom request context to `sendMessage`, `steer`, `followUp`, `approveTool`, and `respondToToolSuspension`, matching what `agent.generate()` already supports. The context is merged into the run's request context on the server, so it reaches dynamic instructions and tools.

```ts
const session = client.getAgentController('code').session('user-1');
await session.sendMessage('hello', { requestContext: { userId: 'user-1', tier: 'pro' } });
```
