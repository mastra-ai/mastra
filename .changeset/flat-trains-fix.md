---
'@mastra/redis': patch
---

Fixed a race in `RedisServerCache` that could lose a replay frame on clients without Lua scripting, or on a Redis Cluster whose list and counter keys hash to different slots.

On that fallback path the index counter was created by incrementing first and overwriting the result with a clock seed afterwards, which discarded an index a concurrent writer had already allocated and published. A reader that had advanced past the seed then dropped that writer's frame as stale. The seed is now written with `SET NX` before the increment, so exactly one writer establishes it and the others count on from whichever won, and the retention rides on the same write so a crash in between cannot leave an unexpiring counter.

Clients that spell `SET NX` differently can adapt it like the other commands; `nodeRedisPreset` and `upstashPreset` already do:

```typescript
new RedisServerCache({ client }, nodeRedisPreset);
```
