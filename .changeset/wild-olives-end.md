---
'@mastra/core': minor
---

Reclaimed a finished agent run's stream state within a day instead of leaving it for a week, and made replay cursors survive an expired log.

**A run's events now share the 24-hour lifetime of its ownership record** — in the replay cache and on the transport that carries them. Deleting them when the run ends is still the fast path (30 seconds after the run settles); the retention is what bounds them when the owning process restarts before its cleanup timer fires. The two lifetimes match deliberately: a run parked on a tool approval appends nothing while it waits, so its events must stay replayable for every moment the record still authorizes `observe()` and resume — otherwise a reader reattaching to a parked run would hang without ever receiving the approval request. Thread stream logs are retained for one hour, since an idle thread's tail only needs to survive a reconnect. Size both with `runLogTtlMs` and `threadStreamLogTtlMs` on `CachingPubSub`.

**Replay indexes are opaque cursors, not positions.** A fresh log starts at a clock-derived value rather than zero, so a log recreated after expiry or eviction normally numbers above what it issued before and an attached observer keeps receiving frames instead of dropping them as already seen. It isn't a guarantee — the numbering follows the cache's clock — so treat storage as the source of truth for a run's messages.

If you resume `observe()` from an offset, keep using the `index` of a chunk you received. A computed position no longer lines up:

```typescript
// Before: a count of chunks received
const { output } = await agent.observe(runId, { offset: received.length });

// After: the last index you actually saw, plus one
const { output } = await agent.observe(runId, { offset: lastChunk.index + 1 });
```

Replaying from `0` to mean "everything available" still works, and chunks without an `index` are unchanged.
