---
'@mastra/redis': patch
---

`RedisServerCache` now supports atomic appends and extend-only expiry.

`listPushIndexed` allocates the entry's index and appends it in one Lua script, and writes the topic log and its counter with one TTL. The list and the counter that numbers it must expire together: a counter that outlives its list restarts at zero while subscribed observers still expect the old numbering, and a counter that expires first reuses indices already in the list. Every append refreshes both keys with `ttlSeconds` (default 300 seconds), and `clearTopic` removes both.

```ts
import { RedisServerCache } from '@mastra/redis';

const cache = new RedisServerCache({ client: redis, ttlSeconds: 300 });
```

`supportsAtomicAppend` reports whether `client.eval` is available, which is what lets `CachingPubSub` number durable run frames and replay them from an offset. Without scripting there is no atomic append, so frames are published unnumbered instead; `listPushIndexed` fails fast with `listPushIndexed requires scripting support (client.eval)` rather than falling back to a non-atomic `increment` plus `listPush`.

`expire(key, ttlMs)` gives a key a deadline of at least `ttlMs`, used to keep a parked run's log alive while it waits for approval. It only ever lengthens: a key that already lives longer, has no expiry, or belongs to a cache configured with `ttlSeconds: 0` is left alone.
