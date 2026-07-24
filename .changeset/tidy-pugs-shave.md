---
'@mastra/core': minor
---

Added `resolveThreadId` to `ChannelConfig`: resolve the internal Mastra thread id before a channel thread is created, mirroring `resolveResourceId`. The hook runs after `resolveResourceId` (the resolved owner is on the context) and only for newly-created threads — existing threads keep their stored id. This lets a host align channel thread ids with ids it controls, e.g. give the thread the same id as the session it belongs to:

```ts
const channels = new AgentChannels({
  adapters,
  resolveResourceId: async ctx => resolveSessionId(ctx),
  resolveThreadId: ({ resourceId, defaultThreadId }) =>
    isSessionId(resourceId) ? resourceId : defaultThreadId,
});
```
