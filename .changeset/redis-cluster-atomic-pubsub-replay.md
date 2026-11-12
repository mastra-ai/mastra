---
'@mastra/core': patch
---

Fixed cached stream events on Redis Cluster falling back to non-atomic index allocation and list writes. `CachingPubSub` now places each topic's replay list and index counter in the same Redis hash slot, so `RedisServerCache` can append and allocate indexes atomically with its Lua script. PubSub topic names are unchanged.

This changes replay cache key names. During a rolling deployment, workers running the new version cannot read replay logs written under the old key names; those logs remain inaccessible until they expire according to their configured TTL.
