---
'@mastra/core': patch
---

Fix `RedisServerCache` examples in the durable-agents docs, the durable-agents example README, and the `createDurableAgent` JSDoc. The examples constructed the cache with `new RedisServerCache({ url: '...' })`, but the actual constructor signature is `new RedisServerCache({ client })` — it takes a connected Redis client (e.g. ioredis), not a URL. Anyone following the production-hardening docs hit a runtime failure on the first cache call. The `{ url }` shape belongs to `UpstashServerCache`, which the snippets were likely copied from.
