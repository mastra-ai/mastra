---
'@mastra/core': patch
---

Fixed `observe()` sending duplicate frames, and made a run's cached frames exactly what it replays.

A durable run's frames are now appended to one log (`MastraServerCache.listPushIndexed`), which allocates the frame's position and stores it in a single atomic step, before the frame is published to the transport. The cached list is the run's history; the transport is only the live tail. A subscriber tracks one cursor: frames below it are dropped as already seen, the frame at it is delivered, and a gap is filled from the log before carrying on. This deletes the watermark/id deduplication and the follower machinery that re-stored frames the log already held, which is where the duplicate frames came from.

Durable runs now publish their frames on the Mastra-level pubsub and cache rather than an agent-level bus, so every worker that claims a step appends to the same run log. This holds for every engine, not only the evented one: abort requests and execution leases go through the same bus, because a peer in another process has to be able to act on the run. An agent constructed with its own `pubsub` keeps it only for thread signals, and logs a warning that its run frames, aborts and leases are observable only on the Mastra transport.

The list and its index counter always share one TTL, and keys are hash-tagged (`pubsub:{topic}`) so the append script stays on a single Redis Cluster slot. `RedisServerCache.counterTtlSeconds` is gone, because a counter that expires separately from its list either restarts at zero or reuses indices.

A durable run's log and counter are kept for 24 hours from their last append (`listPushIndexed` takes an optional TTL that can only raise the cache default), so an approval wait that outlives the cache's default TTL no longer loses the frames a resumed observer still expects. Run cleanup still deletes the log when the run ends; the 24 hours only matter for a run that stays parked or is abandoned without cleanup.

To observe run frames from another process, configure one shared bus and cache (`new Mastra({ pubsub, cache })`); run frames, abort requests and leases follow the Mastra-level pubsub. A transport that was configured on the agent has to move:

```ts
// Before: the agent's own pubsub carried run traffic
const agent = new Agent({ /* ... */, pubsub: redisPubsub });

// After: configure the shared transport on Mastra
const mastra = new Mastra({ agents: { agent }, pubsub: redisPubsub, cache: redisCache });
```

A cache that cannot allocate and append in one step (`supportsAtomicAppend === false`) publishes unnumbered frames: observers see the live tail but cannot resume from an offset. When no shared cache is configured the same applies, and `observe({ offset })` is documented as live-only.

Cached keys are now `pubsub:{topic}` instead of `pubsub:topic`, so history written before an upgrade is not read back after it.
