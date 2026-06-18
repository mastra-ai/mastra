---
'@mastra/core': minor
'@mastra/redis-streams': minor
---

Added a `LeaseProvider` capability (`acquireLease` / `releaseLease` / `renewLease` / `getLeaseOwner`) — a distributed-leasing interface that is separate from event delivery (`PubSub`) — and collapsed the result of `agent.sendSignal` / `sendMessage` / `queueMessage` / `sendStateSignal` / `sendNotificationSignal` into a single `accepted` promise that resolves at decision-time, once Mastra has settled what it will do with the signal.

`result.accepted` resolves to a discriminated union describing what the runtime did: `{ action: 'wake'; runId; output }` when the signal started the agent run in this process, `{ action: 'deliver'; runId }` when the signal was forwarded onto an existing run, or `{ action: 'persist' }` / `{ action: 'discard' }` when nothing ran. `action` mirrors the winning `behavior` from `ifActive`/`ifIdle`. `runId` is the authoritative id of the run that handled the signal and is present only on `wake` and `deliver` (the actions where a run exists); for `persist`/`discard` use `result.signal.id` to correlate the stored message.

`accepted` resolves (it does not reject) for routing decisions — a generation error on a `wake` run surfaces through `output.consumeStream()`, not by rejecting `accepted`. It rejects only when the signal could not be routed or started at all (e.g. a misconfigured agent with no model, or a denied request). Callers that need to react to a failed send can `await result.accepted` inside a `try/catch`.

This replaces the previous `accepted: true` boolean, the separate `outcome` promise, and the best-effort top-level `runId?: string` — there is no longer a phantom `runId` on the lost cross-process wake race. `result.persisted` stays top-level: await it when you need to know the signal has been durably written to memory (`accepted` does not wait on the write for `persist`).

When multiple processes (e.g. serverless Lambdas) race to wake the same agent thread, they first try to acquire a lease through the configured `LeaseProvider`. The winner runs the agent stream and resolves `accepted` to `{ action: 'wake', runId, output }` so the caller can `consumeStream()` it in-process. Losers publish a `signal-enqueued` event so the winner picks up their message, and resolve to `{ action: 'deliver', runId }` since the signal was queued onto the winning run rather than run locally.

```ts
const result = agent.sendSignal(signal, { resourceId, threadId });
ctx.waitUntil(
  result.accepted.then(async accepted => {
    if (accepted.action === 'wake') {
      await accepted.output.consumeStream();
    }
  }),
);
```

Leasing is a distinct concern from pub/sub: a backend only implements `LeaseProvider` when it can genuinely coordinate a lock. `EventEmitterPubSub` uses an in-memory `Map` with TTL. `RedisStreamsPubSub` uses `SET NX PX` plus a Lua compare-and-delete release, which is the standard distributed-lock pattern (atomic claim, crash-safe TTL, owner-verified release). `CachingPubSub` is transparent to leasing — it surfaces its inner backend's lease provider. Backends that cannot lease fall back to an always-win / no-op provider, preserving single-process behavior where every caller wins its own lease race.

The lease uses a short TTL (15s) renewed in the background at TTL/3 (5s) while the owner's run is still going, and is released on run completion, abort, or stream error. If the owner crashes, the lease expires within 15s and another process can claim the thread on the next signal.
