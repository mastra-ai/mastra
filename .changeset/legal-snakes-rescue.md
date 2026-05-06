---
'@mastra/redis': patch
---

**Per-key TTL support for the cache**

`MastraServerCache.set()` now accepts an optional `ttlMs` argument that overrides the cache's default TTL for a single entry. This unblocks features like agent response caching that need different expirations per entry without bypassing the cache abstraction.

```ts
await cache.set('weather:nyc', payload, 60_000); // expires in 60s
```
