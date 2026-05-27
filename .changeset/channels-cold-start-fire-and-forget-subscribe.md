---
'@mastra/core': patch
---

Reduced per-message latency in channels by removing two awaited storage round-trips from the chat message dispatch path. `chatThread.subscribe()` (a Chat SDK metadata write) now fires alongside `sendSignal` instead of blocking before it, and the agent run receives the thread by id instead of a refreshed snapshot. The post-subscribe snapshot refresh was a workaround for a clobber in `prepareMemoryStep` that was fixed in #16846, so it is no longer needed.
