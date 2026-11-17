---
'@mastra/redis-streams': minor
---

Added `createMonitorClient()` and `streamKey()` to `RedisStreamsPubSub`, so health checks can inspect Redis on their own connection instead of queueing behind event traffic:

```ts
const client = pubsub.createMonitorClient(); // unconnected; commands fail fast while disconnected
await client.connect();
const groups = await client.xInfoGroups(pubsub.streamKey('workflows'));
await client.destroy();
```
