---
'@mastra/core': patch
---

Fixed `observe()` sending duplicate frames, and made a run's cached frames exactly what it replays.

A durable run's frames are now appended to one log (`MastraServerCache.listPushIndexed`), which allocates the frame's position and stores it before the frame is published to the transport. The cached list is the run's history; the transport is only the live tail. A subscriber tracks one cursor: frames below it are dropped as already seen, the frame at it is delivered, and a gap is filled from the log before carrying on. This replaces the id deduplication and the follower machinery that re-stored frames the log already held, which is where the duplicate frames came from. `CachingPubSubOptions.source` and `CachingPubSub.__setSource()` are still accepted but deprecated and have no effect: evented steps now cache their frames when they publish.

On the evented engine, a run's frames, abort requests and execution leases now use the Mastra-level pubsub and cache, because each step publishes from whichever worker claims it; every worker then appends to the same run log. An evented agent constructed with its own `pubsub` on a different transport logs a warning. To observe evented runs from another process, configure the shared transport on Mastra (`new Mastra({ pubsub, cache })`). The default engine is unchanged and keeps using an agent-level `pubsub` when one is set.

Because every frame is in the log before it reaches the transport, a frame the transport delivers late is filled in from the log at its original position instead of being dropped. This includes reasoning from an attempt a signal preempted, which clients already see when it arrives on time; it is still kept out of memory and the replacement request.

When no shared cache is configured, `observe({ offset })` is live-only: observers see the live tail but cannot resume from an offset. With the default in-memory cache and a transport that reaches other processes, evented steps publish their frames uncached, as before, because each process would otherwise number frames from its own counter.
