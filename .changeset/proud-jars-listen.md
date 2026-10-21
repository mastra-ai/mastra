---
'@mastra/redis': patch
---

`RedisServerCache.listPushIndexed` now writes the topic log and its index counter with one TTL, and no longer needs the separate counter expiry.

`counterTtlSeconds` is removed. The list and the counter that numbers it must expire together: a counter that outlives its list restarts at zero while subscribed observers still expect the old numbering, and a counter that expires first reuses indices already in the list. Every append refreshes both keys with `ttlSeconds` (default 300 seconds), and `clearTopic` removes both.

```ts
import { RedisServerCache } from '@mastra/redis';

const cache = new RedisServerCache({ client: redis }, { ttlSeconds: 300 });
```

`listPushIndexed` fails fast with `listPushIndexed requires scripting support (client.eval)` instead of falling back to a non-atomic `increment` plus `listPush` on clients without `eval`. Without scripting there is no atomic append, so `CachingPubSub` publishes unnumbered frames there rather than risk an observer dropping live ones.
