---
'@mastra/core': patch
---

Reduced how much a long durable agent run writes to storage, and made runs in flight at shutdown recoverable ([#26600](https://github.com/mastra-ai/mastra/issues/26600)).

- **Smaller checkpoints:** a durable run's checkpoints no longer repeat messages the run has already saved to memory (for example with `savePerStep: true`). They store a reference to the memory row instead, as recalled messages already did, so the write size stops growing with every saved step. Messages that change after being saved stay inline. This applies to agents with a fixed memory instance.
- **Checkpoint on shutdown:** with the default snapshot policy and `recovery.durableAgents: 'off'`, a durable run still in flight when `mastra.shutdown()` starts now persists a `running` checkpoint at its next step boundary, so it can be resumed later with `recover()` or `recoverActiveRuns()` instead of being lost.

```typescript
// Process A: a run is still in flight when the process shuts down.
await mastra.shutdown({ drainTimeout: 5_000 });

// Process B: resume every run checkpointed during the drain.
await mastra.recoverAllDurableAgents();
// or per agent: await durableAgent.recoverActiveRuns();
```
