---
'@mastra/core': patch
---

Fixed resuming a stream from an offset silently skipping events. If the cache gave out an event index but then failed to store the event (possible on caches without an atomic append, such as Redis Cluster, or a Convex deployment whose cache functions haven't been redeployed), replaying from an offset could drop the events right after the missing one. Replay, gap backfill, and `getHistory` now return the stored events from the requested offset in index order. The event whose write failed is still lost.

Known limitation: on caches without an atomic append, concurrent publishes can store events out of order, and an event stored earlier in the list than the replay start can still be missed. An atomic append avoids this.
