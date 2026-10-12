---
'@mastra/core': patch
---

Fixed durable and evented agent runs that reuse a `runId` picking up another run's messages. When a run ended early (for example on a tripwire) while its background work was still finishing, a new run started with the same `runId` in a different Mastra instance could receive the earlier run's messages and tool results in its prompt. Each Mastra instance now only reads and writes its own in-progress run state.
