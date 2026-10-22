---
'@mastra/redis': patch
---

`RedisServerCache.listPushIndexed` accepts an optional TTL as its fourth argument. Durable run logs use it to stay cached for 24 hours, so an approval wait that outlives the cache's default TTL keeps its frames.

Every append sets the list and its counter to `ttlSeconds` (default 300 seconds), or to the longer TTL passed in. A requested TTL never shortens `ttlSeconds`, and a cache configured with `ttlSeconds: 0` stays without expiry.

```ts
await cache.listPushIndexed('pubsub:{run}', 'pubsub:{run}:counter', frame, 24 * 60 * 60 * 1000);
```
