---
'@mastra/factory': patch
---

Factory now recognizes a phase run's end even when the run finished in another process. Each run's end is recorded on its session thread, and a dispatcher that doesn't see the run's `agent_end` reads that record. Before, the dispatcher failed the run with "terminal event was not observed". While another process still heartbeats the run, the dispatcher keeps waiting.
