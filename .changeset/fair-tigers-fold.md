---
'@mastra/core': minor
---

Added support for refreshing advertised agent peer details without reclaiming thread ownership.

```ts
const updated = agent.updateThreadPeerAdvertisement({
  resourceId: 'resource-1',
  threadId: 'thread-1',
  peer: { title: 'Updated thread title', metadata: { mode: 'review' } },
});
```
