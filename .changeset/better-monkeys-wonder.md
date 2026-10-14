---
'@mastra/core': patch
---

Fixed `DurableAgent.observe(runId)` when attaching to a run from another process.

- Restored the agent's configured output processors, request context, and `returnScorerData` setting.
- Made durable stream `onChunk` callbacks run serially and in order.
- Made `onFinish` wait for pending `onChunk` callbacks to finish.
