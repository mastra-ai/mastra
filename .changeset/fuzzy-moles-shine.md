---
'@mastra/convex': patch
---

`ConvexServerCache` now appends and numbers a topic log in one mutation.

`listPushIndexed(listKey, counterKey, value, ttlMs?)` allocates the entry's index and inserts it in a single serializable mutation, so a subscriber can never read an index whose entry is not in the list yet. `supportsAtomicAppend` reports `true`, which is what lets `CachingPubSub` number durable run frames and replay them from an offset. Pass `ttlMs` to keep a run's log past the cache's default `ttlMs` while the run is suspended. An expired counter is cleared before a new index is allocated, and both the list and its counter are written with the same expiry.
