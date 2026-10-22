---
'@mastra/redis': patch
---

`RedisServerCache` now supports atomic appends.

`listPushIndexed` allocates the entry's index and appends it in one Lua script, and writes the topic log and its counter with one TTL. The list and the counter that numbers it must expire together: a counter that outlives its list restarts at zero while subscribed observers still expect the old numbering, and a counter that expires first reuses indices already in the list. Every append sets both keys to `ttlSeconds` (default 300 seconds), or to the longer TTL the caller passes as the fourth argument, and `clearTopic` removes both. A cache configured with `ttlSeconds: 0` stays without expiry.

```ts
import { RedisServerCache } from '@mastra/redis';

const cache = new RedisServerCache({ client: redis, ttlSeconds: 300 });
```

`supportsAtomicAppend` reports whether `client.eval` is available, which is what lets `CachingPubSub` number durable run frames and replay them from an offset. Without scripting there is no atomic append, so frames are published unnumbered instead; `listPushIndexed` fails fast with `listPushIndexed requires scripting support (client.eval)` rather than falling back to a non-atomic `increment` plus `listPush`.
