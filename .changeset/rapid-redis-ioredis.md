---
'@mastra/redis': patch
---

Fixed an ioredis cluster MOVED pollution advisory by updating the test client to ioredis 6.0.0. RedisStore still uses node-redis; production APIs are unchanged.
