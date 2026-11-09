---
'@mastra/core': patch
---

Fixed resuming a stream from an offset silently skipping events. If the cache gave out an event index but then failed to store the event, replaying from an offset could drop the events right after the missing one. This could happen on caches that store the index and the event in two separate steps, such as Redis Cluster, or a Convex deployment whose cache functions haven't been redeployed. Replaying a stream, filling gaps in a live stream, and `getHistory` now return the stored events from the requested offset in order. The event whose write failed is still lost.

Known limitation: on those same caches, events published at the same time can be stored out of order, and an event stored earlier in the list than the replay start can still be missed. Caches that store the index and the event in one step are not affected.
