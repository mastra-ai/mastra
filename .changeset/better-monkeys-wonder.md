---
'@mastra/core': patch
---

Fixed `DurableAgent.observe(runId)` when attaching to a run from another process.

- Restored the agent's configured output processors, request context, and `returnScorerData` setting.
- **Behavior change:** Cross-process `DurableAgent.observe(runId)` now throws `DURABLE_AGENT_OBSERVE_AGENT_MISMATCH` when the persisted run belongs to an agent with a different ID, matching `resume()` and `recover()`. Use the same agent ID in the observing process as in the process that started the run.
- Made durable stream `onChunk` callbacks run serially and in order.
- Made `onFinish` wait for pending `onChunk` callbacks to finish.
