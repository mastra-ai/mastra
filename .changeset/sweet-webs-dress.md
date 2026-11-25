---
'@mastra/core': patch
---

Evented agents on several processes no longer keep a timed lease on each run. This applies when the PubSub backend redelivers unacknowledged events and the storage adapter supports run fencing and workflow step guards, for example `RedisStreamsPubSub` with `@mastra/pg`. The backend decides which worker handles each event, and nothing renews the run's claim.

- A long model or tool call, or an event a worker picks up late, no longer fails because the lease ran out or storage was slow.
- `recover(runId)` takes the run over right away, with or without `force`, even when the run is healthy. Workers abort the run's in-flight model and tool calls once they see the new claim.
- `recoverActiveRuns()` and `mastra.recoverAllDurableAgents()` leave these runs to the PubSub backend. Given a `runId`, `recoverActiveRuns()` skips a run that's still claimed, with reason `run-active` and no `retryAt`.

Other setups keep the renewed lease.
