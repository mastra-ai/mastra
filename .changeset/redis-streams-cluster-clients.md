---
'@mastra/redis-streams': minor
---

Add a `clientFactory` option to `RedisStreamsPubSub` for supplying a custom `redis` client — including a Redis Cluster client from `createCluster()`. When provided, the factory is called once for the shared writer and once for each subscription's blocking reader, so every connection is a distinct client; when omitted, clients are still built from `url`/`redisOptions` as before.

Also fixed a race where concurrent cold `subscribe()`/`publish()` calls could each call `connect()` on the shared writer. On a Cluster client `isOpen` becomes true only after slot discovery completes, so a second concurrent `connect()` crashed in slot lookup. Concurrent initial connections now share a single in-flight connect promise, while automatic node-redis reconnect is preserved.
