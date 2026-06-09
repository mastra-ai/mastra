---
'@mastra/core': minor
'@mastra/redis-streams': minor
---

Add a lease API to `PubSub` (`acquireLease` / `releaseLease` / `renewLease` / `getLeaseOwner`) and return an `ownerStream` from `agent.sendSignal` / `sendMessage` / `queueMessage` / `sendStateSignal` / `sendNotificationSignal`.

When multiple processes (e.g. serverless Lambdas) race to wake the same agent thread, they now first try to acquire a lease in the shared pubsub. The winner runs the agent stream and returns the `ownerStream` so the caller can `consumeStream()` it in-process. Losers publish a `signal-enqueued` event so the winner picks up their message, and resolve `ownerStream` to `undefined`.

The default `PubSub` implementation (single process) trivially acquires the lease. `EventEmitterPubSub` uses an in-memory `Map` with TTL. `RedisStreamsPubSub` uses `SET NX PX` plus a Lua compare-and-delete release, which is the standard distributed-lock pattern (atomic claim, crash-safe TTL, owner-verified release).
