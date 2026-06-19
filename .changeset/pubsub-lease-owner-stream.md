---
'@mastra/core': minor
'@mastra/redis-streams': minor
---

Collapsed the result of `agent.sendSignal` / `sendMessage` / `queueMessage` / `sendStateSignal` / `sendNotificationSignal` into a single `accepted` promise that resolves at decision-time to a discriminated union: `{ action: 'wake'; runId; output }` when the signal started a run in this process, `{ action: 'deliver'; runId }` when it was forwarded onto an existing run, or `{ action: 'persist' }` / `{ action: 'discard' }` when nothing ran. `runId` is present only on `wake`/`deliver`; for `persist`/`discard` correlate via `result.signal.id`. `accepted` resolves for routing decisions and rejects only when the signal couldn't be routed at all (e.g. misconfigured agent). This replaces the old `accepted: true` boolean, the separate `outcome` promise, and the best-effort top-level `runId`. `result.persisted` stays top-level. `sendNotificationSignal`'s `accepted` is optional (a notification may be dropped by policy with no signal) — read `result.decision` for the policy verdict.

```ts
const result = agent.sendSignal(signal, { resourceId, threadId });
ctx.waitUntil(
  result.accepted.then(async accepted => {
    if (accepted.action === 'wake') await accepted.output.consumeStream();
  }),
);
```

Added a `LeaseProvider` capability (`acquireLease` / `releaseLease` / `renewLease` / `getLeaseOwner`) — distributed leasing kept separate from event delivery (`PubSub`) — so processes racing to wake the same thread coordinate a single owner. The winner runs the stream; losers forward their signal to it. `EventEmitterPubSub` leases in-memory; `RedisStreamsPubSub` uses `SET NX PX` with an owner-verified Lua release; backends that can't lease fall back to an always-win no-op, preserving single-process behavior.
