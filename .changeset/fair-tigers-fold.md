---
'@mastra/core': minor
---

Added support for the active thread owner to refresh advertised agent peer details without reclaiming thread ownership. Updates from other agent instances are rejected, even when they share the same agent id.

```ts
const updated = agent.updateThreadPeerAdvertisement({
  resourceId: 'resource-1',
  threadId: 'thread-1',
  peer: { title: 'Updated thread title', metadata: { mode: 'review' } },
});
```
