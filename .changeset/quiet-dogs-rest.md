---
'@mastra/valkey': patch
---

`ValkeyServerCache` now reports `supportsAtomicAppend: true` and supports extend-only expiry.

Its `listPushIndexed` already allocated the index and appended the entry in one Lua script, but the new cache capability bit defaults to `false`, which would have silently downgraded Valkey-backed caches to publishing unnumbered frames. With the bit set, `CachingPubSub` numbers durable run frames and can replay them from an offset.

`expire(key, ttlMs)` gives a key a deadline of at least `ttlMs`, used to keep a parked run's log alive while it waits for approval. It only ever lengthens: a key that already lives longer, has no expiry, or belongs to a cache configured with `ttlSeconds: 0` is left alone.
