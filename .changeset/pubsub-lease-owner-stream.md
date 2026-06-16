---
'@mastra/core': minor
'@mastra/redis-streams': minor
---

Added a lease API to `PubSub` (`acquireLease` / `releaseLease` / `renewLease` / `getLeaseOwner`) and returned an `outcome` promise from `agent.sendSignal` / `sendMessage` / `queueMessage` / `sendStateSignal` / `sendNotificationSignal` that resolves once Mastra has decided what to do with the signal.

`outcome` resolves to a discriminated union describing what the runtime did: `{ action: 'wake'; output }` when the signal started the agent run in this process, or `{ action: 'deliver' | 'persist' | 'discard' }` otherwise. `action` mirrors the winning `behavior` from `ifActive`/`ifIdle`. When multiple processes (e.g. serverless Lambdas) race to wake the same agent thread, they first try to acquire a lease in the shared pubsub. The winner runs the agent stream and resolves `outcome` to `{ action: 'wake', output }` so the caller can `consumeStream()` it in-process. Losers publish a `signal-enqueued` event so the winner picks up their message, and resolve to `{ action: 'deliver' }` since the signal was queued onto the winning run rather than run locally.

```ts
const result = agent.sendSignal(signal, { resourceId, threadId });
ctx.waitUntil(
  result.outcome.then(async ({ action, output }) => {
    if (action === 'wake' && output) {
      await output.consumeStream();
    }
  }),
);
```

The default `PubSub` implementation (single process) trivially acquires the lease. `EventEmitterPubSub` uses an in-memory `Map` with TTL. `RedisStreamsPubSub` uses `SET NX PX` plus a Lua compare-and-delete release, which is the standard distributed-lock pattern (atomic claim, crash-safe TTL, owner-verified release).

The lease uses a short TTL (15s) renewed in the background at TTL/3 (5s) while the owner's run is still going, and is released on run completion, abort, or stream error. If the owner crashes, the lease expires within 15s and another process can claim the thread on the next signal.
