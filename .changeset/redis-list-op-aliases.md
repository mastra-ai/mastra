---
'@mastra/redis': patch
---

`nodeRedisPreset` now adapts the three list operations (`llen`, `rpush`, `lrange`) to their camelCase forms on `node-redis` v4+ clients (`lLen`, `rPush`, `lRange`). Extends the same adapter pattern already used for `set` and `scan`. ioredis and Upstash users are unaffected (defaults remain lowercase, matching their APIs).
