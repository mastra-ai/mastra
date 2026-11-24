---
'@mastra/core': minor
---

Reclaimed a finished agent run's stream state in about an hour instead of leaving it for days (COR-1534), and made replay cursors survive an expired log.

**Run and thread event retention is now one hour.** A run's events are retained for an hour after the last append, in both the replay cache and the transport that carries them. Deleting them when the run ends is still the fast path; the retention is what bounds them when the owning process restarts before its cleanup timer fires. Size it with `runLogTtlMs` and `threadStreamLogTtlMs` on `CachingPubSub`. A run's ownership record keeps its own 24-hour lifetime, so a run parked overnight on a tool approval stays authorizable for observe and resume long after its replay log has gone.

**Replay indexes are opaque cursors, not positions.** A fresh log starts at a clock-derived value rather than zero, so a log recreated after expiry or eviction normally numbers above what it issued before and an attached observer keeps receiving frames instead of dropping them as already seen. It isn't a guarantee — the numbering follows the cache's clock — so treat storage as the source of truth for a run's messages.

If you resume `observe()` from an offset, keep using the `index` of a chunk you received. A computed position no longer lines up:

```typescript
// Before: a count of chunks received
const { output } = await agent.observe(runId, { offset: received.length });

// After: the last index you actually saw, plus one
const { output } = await agent.observe(runId, { offset: lastChunk.index + 1 });
```

Replaying from `0` to mean "everything available" still works, and chunks without an `index` are unchanged.
