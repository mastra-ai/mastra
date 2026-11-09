---
'@mastra/core': patch
---

Fixed resuming a stream from an offset silently skipping events. If the cache gave out an event index but then failed to store the event (possible on caches without an atomic append, such as Redis Cluster), replaying from an offset could drop the events right after the missing one. Replay, gap backfill, and `getHistory` now return every stored event from the requested offset on.
