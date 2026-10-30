---
'@mastra/redis-streams': minor
'@mastra/valkey-streams': minor
---

Idle topic streams now expire after 7 days by default. Previously `streamIdleTtlMs` defaulted to `0`, so a pubsub created without it never expired any stream. A production deployment built that way accumulated thousands of never-expiring conversation streams until Redis ran out of memory.

Every write still refreshes the TTL, so a topic in active use never expires. If a grouped worker can be offline for more than 7 days while publishers are quiet, and must replay the backlog when it comes back, raise the TTL or turn expiry off:

```typescript
// Before: streams created by this pubsub never expired
// After: they expire after 7 days without a write
new RedisStreamsPubSub({ url });

// To keep the old behavior, turn expiry off explicitly
new RedisStreamsPubSub({ url, streamIdleTtlMs: 0 });
```

**Check your eviction policy before upgrading.** Under a `volatile-*` policy, Redis only evicts keys that have a TTL. Streams used to have none, so they were safe from eviction; now they can be evicted under memory pressure, losing events. Set `maxmemory-policy` to `noeviction`.

Existing streams created without a TTL only get one on their next write. See the reference docs for a runbook to reclaim them.

The pubsub also logs a warning once after connecting if the server has `maxmemory` set with any policy other than `noeviction`. Evicting policies (Amazon ElastiCache defaults to `volatile-lru`) delete live streams, consumer groups, and lease keys under memory pressure.
