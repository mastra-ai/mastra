---
'@mastra/redis-streams': minor
---

Support Redis Cluster and bring-your-own clients in `RedisStreamsPubSub`.

- `cluster`: options forwarded to `createCluster()` from `redis`, for cluster-mode deployments such as AWS ElastiCache with cluster mode enabled.
- `client`: a pre-configured, unconnected `redis` client (standalone or cluster) used as the writer; each subscription's blocking reader is created with `client.duplicate()`. The pubsub owns the client's lifecycle (connects lazily, quits on `close()`).

`url`/`redisOptions`, `cluster`, and `client` are mutually exclusive; passing more than one throws at construction.

```ts
import { RedisStreamsPubSub } from '@mastra/redis-streams';

const pubsub = new RedisStreamsPubSub({
  cluster: { rootNodes: [{ url: 'redis://node-1:6379' }, { url: 'redis://node-2:6379' }] },
});
```

Also fixed a cold-start race in the shared writer connection. node-redis flips `isOpen` to `true` synchronously inside `connect()`, before the socket is ready (standalone) or slot discovery completes (cluster). Concurrent first-use callers - for example many `subscribe()` calls at boot - could pass the `isOpen` check while the initial connect was still in flight; on a Cluster client that crashed in slot lookup (`Cannot read properties of undefined (reading 'master')`). All cold callers now await the same in-flight `connect()`. node-redis's automatic mid-life reconnect is unaffected.
