---
'@mastra/redis': patch
---

**Per-key TTL support in `RedisCache`**

`RedisCache.set()` now accepts an optional `ttlMs` argument that overrides the configured default TTL for a single entry. Sub-second values are rounded up to one second (Redis `EXPIRE` granularity); a non-positive value persists the entry without expiry.

```ts
const cache = new RedisCache({ url: 'redis://...' });
await cache.set('weather:nyc', payload, 60_000); // expires in 60s
await cache.set('manifest', payload, 0); // persists indefinitely
```
