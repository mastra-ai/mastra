---
'@mastra/redis': patch
---

`RedisServerCache.listPushIndexed` now writes the topic log and its index counter with one TTL, and no longer needs the separate counter expiry.

`counterTtlSeconds` is removed. The list and the counter that numbers it must expire together: a counter that outlives its list restarts at zero while subscribed observers still expect the old numbering, and a counter that expires first reuses indices already in the list. Every append refreshes both keys with the list TTL (`ttlSeconds`, default 300 seconds) or with the `ttlMs` passed to that call, and `clearTopic` removes both.

```ts
import { RedisServerCache } from '@mastra/redis';

const cache = new RedisServerCache({ client: redis }, { ttlSeconds: 300 });

// A durable run's frames outlive a suspended run, so this topic asks for longer.
await cache.listPushIndexed('pubsub:agent.stream.run-1', 'pubsub:agent.stream.run-1:counter', event, 86_400_000);
```

The append script also now persists both keys when the TTL is `0`, and fails fast with `listPushIndexed requires scripting support (client.eval)` instead of falling back to a non-atomic `increment` plus `listPush` on clients without `eval`. Without scripting there is no atomic append, so `CachingPubSub` publishes unnumbered frames there rather than risk an observer dropping live ones.
