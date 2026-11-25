---
'@mastra/core': patch
---

Evented agents on several processes no longer keep a timed lease on each run. When the PubSub backend redelivers unacknowledged events and the storage adapter supports run fencing and workflow step guards (for example `RedisStreamsPubSub` with `@mastra/pg`), the backend decides which worker handles each event, and the run's claim is never renewed.

- A long model or tool call, or an event a worker picks up late, no longer fails because the lease ran out or storage was slow.
- `recover(runId)` takes over a stuck run right away, with or without `force`.
- `recoverActiveRuns()` and `mastra.recoverAllDurableAgents()` leave these runs to the PubSub backend instead of restarting them next to a redelivery.

Other setups keep the renewed lease.
