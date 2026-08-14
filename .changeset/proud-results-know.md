---
'@mastra/redis': patch
---

Fixed increment() never applying the configured TTL. Counter keys written via increment() now expire like every other key in RedisServerCache, preventing unbounded Redis key growth.
