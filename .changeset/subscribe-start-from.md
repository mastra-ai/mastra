---
'@mastra/core': minor
'@mastra/redis-streams': minor
---

Add `SubscribeOptions.startFrom` so a subscription can begin at the current tail

`subscribe()` replayed the retained backlog and `subscribeWithReplay()` replayed all of it,
but there was no way to say "deliver only what happens from now on". A consumer that already
owns the completed history through another store had to first call `getHistory()` to learn the
current length and pass it as an offset — racy, and only possible on transports that implement
`getHistory`.

`startFrom: 'latest'` expresses it directly. It defaults to `'earliest'`, so existing behavior
is unchanged, and it only applies when a consumer group is created — an existing group keeps its
own checkpoint, so this can never rewind or skip past a position a running cluster has committed.
On transports that do not retain messages it is a no-op, which is already the correct semantics.

For Redis Streams this maps onto `XGROUP CREATE ... $` instead of `0`.

Also adds a `PubSub.supportsOffsets` capability getter. `subscribeFromOffset()` falls back to
`subscribeWithReplay()` on transports without indexed history, silently discarding the offset and
delivering the full backlog — which turns a caller's guard against re-processing into a no-op.
Callers can now check `supportsOffsets` before relying on offset semantics, and implementations
with a logger surface the discarded offset instead of dropping it silently.
