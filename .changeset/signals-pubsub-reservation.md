---
'@mastra/core': minor
'@mastra/redis-streams': minor
---

Add cross-process thread reservation to the signals layer so concurrent webhooks (e.g. serverless Lambdas receiving the same Slack event) elect a single wake owner instead of each starting their own run.

`PubSub` gains four optional methods (`tryReserve`, `getReservation`, `releaseReservation`, `renewReservation`) with no-op defaults that preserve existing single-process behavior. `EventEmitterPubSub` implements them with an in-memory TTL map, and `@mastra/redis-streams` implements them with atomic `SET NX PX` + Lua-guarded release.

In the idle-wake path of `sendSignal`, the runtime now calls `pubsub.tryReserve(threadKey, runId, ttl)` before starting `agent.stream(...)`. The winning process drives the run as today. A losing process publishes the user signal to the winner's `runId` so the message is not dropped, then resolves its `ownerStream` to `undefined`.

`SendAgentSignalResult.ownerStream` is now typed `Promise<MastraModelOutput<OUTPUT> | undefined>`. Callers that already guarded the property (or used `await result.ownerStream?.consumeStream()`) require no changes.
