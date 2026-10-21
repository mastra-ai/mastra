---
'@mastra/valkey': patch
---

`ValkeyServerCache.listPushIndexed` accepts a per-call TTL so the topic log and its index counter can outlive the default `ttlSeconds` when a caller needs them to.

```ts
await cache.listPushIndexed('pubsub:agent.stream.run-1', 'pubsub:agent.stream.run-1:counter', event, 86_400_000);
```

Both keys are always written with the same expiry, since a counter that outlives its list restarts at zero and an index that expires first gets reused. A TTL of `0` now persists both keys instead of leaving them to expire.
