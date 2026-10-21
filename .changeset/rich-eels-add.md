---
'@mastra/core': patch
---

Fixed `observe()` sending duplicate frames, and made a run's cached frames exactly what it replays.

A durable run's frames are now appended to one log (`MastraServerCache.listPushIndexed`), which allocates the frame's position and stores it in a single atomic step, before the frame is published to the transport. The cached list is the run's history; the transport is only the live tail. A subscriber tracks one cursor: frames below it are dropped as already seen, the frame at it is delivered, and a gap is filled from the log before carrying on. This deletes the watermark/id deduplication and the follower machinery that re-stored frames the log already held, which is where the duplicate frames came from.

Evented durable steps now publish run frames on the Mastra-level pubsub and cache rather than their own bus, so every worker that claims a step appends to the same run log. An agent constructed with its own `pubsub` keeps that bus for signals and aborts, and logs a warning that its run frames are observable only on the Mastra transport.

The list and its index counter always share one TTL, and keys are hash-tagged (`pubsub:{topic}`) so the append script stays on a single Redis Cluster slot. `RedisServerCache.counterTtlSeconds` is gone; durable run topics pass a longer per-write TTL instead.

A cache that cannot allocate and append in one step (`supportsAtomicAppend === false`) publishes unnumbered frames: observers see the live tail but cannot resume from an offset. When no shared cache is configured the same applies, and `observe({ offset })` is documented as live-only.

Cached keys are now `pubsub:{topic}` instead of `pubsub:topic`, so history written before an upgrade is not read back after it.
