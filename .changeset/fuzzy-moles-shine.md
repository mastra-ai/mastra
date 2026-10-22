---
'@mastra/convex': patch
---

`ConvexServerCache` now appends and numbers a topic log in one mutation.

`listPushIndexed(listKey, counterKey, value)` allocates the entry's index and inserts it in a single serializable mutation, so a subscriber can never read an index whose entry is not in the list yet. `supportsAtomicAppend` reports `true`, which is what lets `CachingPubSub` number durable run frames and replay them from an offset. An expired counter is cleared before a new index is allocated, and both the list and its counter are written with the same expiry: the cache's TTL, or a longer one passed as the optional fourth argument.

```ts
const index = await cache.listPushIndexed('pubsub:{run-1}', 'pubsub:{run-1}:counter', frame);
// frame is stored with `index` set, and the counter for that log reads `index`.
```
