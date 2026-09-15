---
'@mastra/core': minor
'@mastra/factory': patch
---

Added `AgentChannels.rebindThread()` so a host can move a live channel conversation onto a different Mastra thread and resource. The previous thread keeps its history but stops receiving channel traffic, and every later platform message on that conversation reaches the new thread. `AgentControllerChannels.getSessionForThread()` is now public so hosts can open the session for a rebound thread with the same session-start hooks an inbound message would run.

```ts
const channels = controller.getChannels();
await channels.rebindThread({
  platform: 'slack',
  externalThreadId: 'slack:C123:1700.42',
  channelId: 'C123',
  resourceId: newSessionId,
  threadId: newSessionId,
});
const session = await channels.getSessionForThread({ id: newSessionId, resourceId: newSessionId }, requestContext);
await session.sendMessage({ content: 'Continue here.' });
```
