---
'@mastra/valkey': patch
---

`ValkeyServerCache.listPushIndexed` accepts an optional TTL as its fourth argument. It can raise, never lower, the cache's `ttlSeconds` for both the list and its counter, so durable run logs can stay cached for 24 hours while a run waits on an approval.

```ts
await cache.listPushIndexed('pubsub:run', 'pubsub:run:counter', frame, 24 * 60 * 60 * 1000);
```
