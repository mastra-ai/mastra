---
'@mastra/core': patch
---

Fixed `observe()` sending duplicate frames, and made a run's cached frames exactly what it replays.

A durable run's frames are now appended to one log (`MastraServerCache.listPushIndexed`), which allocates the frame's position and stores it in a single atomic step, before the frame is published to the transport. The cached list is the run's history; the transport is only the live tail. A subscriber tracks one cursor: frames below it are dropped as already seen, the frame at it is delivered, and a gap is filled from the log before carrying on. This deletes the watermark/id deduplication and the follower machinery that re-stored frames the log already held, which is where the duplicate frames came from.

Evented durable steps now publish run frames on the Mastra-level pubsub and cache rather than their own bus, so every worker that claims a step appends to the same run log. An agent constructed with its own `pubsub` keeps that bus for signals and aborts, and logs a warning that its run frames are observable only on the Mastra transport.

The list and its index counter always share one TTL, and keys are hash-tagged (`pubsub:{topic}`) so the append script stays on a single Redis Cluster slot. `RedisServerCache.counterTtlSeconds` is gone, because a counter that expires separately from its list either restarts at zero or reuses indices.

A run that parks on a tool approval extends the retention of its log and counter to 24 hours (`MastraServerCache.expire`, implemented for the in-memory, Redis and Valkey caches), so an approval wait that outlives the cache's default TTL no longer loses the frames a resumed observer still expects. The extension only ever lengthens: a cache configured to keep keys longer, or with no expiry, keeps its own deadline. Terminal cleanup deletes the log as before, so the extension only covers the parked window.

Set `suspendedRunLogRetentionMs` on the `durable` option to change that window (default 24 hours); a non-positive value leaves the cache's own TTL in place:

```ts
const agent = new Agent({
  // ...
  durable: { suspendedRunLogRetentionMs: 48 * 60 * 60 * 1000 },
});
```

`MastraServerCache.expire(key, ttlMs)` is the underlying contract: give the key a deadline of at least `ttlMs` from now, never shorten it. Its default implementation is a no-op, so third-party caches keep their configured TTL.

To observe run frames from another process, configure one shared bus and cache (`new Mastra({ pubsub, cache })`); run frames follow the Mastra-level pubsub.

A cache that cannot allocate and append in one step (`supportsAtomicAppend === false`) publishes unnumbered frames: observers see the live tail but cannot resume from an offset. When no shared cache is configured the same applies, and `observe({ offset })` is documented as live-only.

Cached keys are now `pubsub:{topic}` instead of `pubsub:topic`, so history written before an upgrade is not read back after it.
