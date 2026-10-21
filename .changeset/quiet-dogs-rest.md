---
'@mastra/valkey': patch
---

`ValkeyServerCache` now reports `supportsAtomicAppend: true`.

Its `listPushIndexed` already allocated the index and appended the entry in one Lua script, but the new cache capability bit defaults to `false`, which would have silently downgraded Valkey-backed caches to publishing unnumbered frames. With the bit set, `CachingPubSub` numbers durable run frames and can replay them from an offset.
