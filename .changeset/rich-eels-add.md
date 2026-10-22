---
'@mastra/core': patch
---

Fixed `observe()` sending duplicate frames, and made a run's cached frames exactly what it replays.

A durable run's frames are now appended to one log (`MastraServerCache.listPushIndexed`), which allocates the frame's position and stores it before the frame is published to the transport. The cached list is the run's history; the transport is only the live tail. A subscriber tracks one cursor: frames below it are dropped as already seen, the frame at it is delivered, and a gap is filled from the log before carrying on. This replaces the id deduplication and the follower machinery that re-stored frames the log already held, which is where the duplicate frames came from. `CachingPubSubOptions.source` and `CachingPubSub.__setSource()` are still accepted but deprecated and have no effect: evented steps now cache their frames when they publish.

On the evented engine, a run's frames, abort requests and execution leases now use the Mastra-level pubsub and cache, because each step publishes from whichever worker claims it; every worker then appends to the same run log. An evented agent constructed with its own `pubsub` on a different transport logs a warning. To observe evented runs from another process, configure the shared transport on Mastra (`new Mastra({ pubsub, cache })`). The default engine is unchanged and keeps using an agent-level `pubsub` when one is set.

When no shared cache is configured, `observe({ offset })` is live-only: observers see the live tail but cannot resume from an offset.
