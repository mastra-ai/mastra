---
'@mastra/factory': patch
---

Factory now recognizes a phase run's end even when the run finished in another process. Each run's end is recorded on the run's own row in Factory storage, and a dispatcher that doesn't see the run's `agent_end` reads it there. Before, the dispatcher failed the run with "terminal event was not observed". While another process still heartbeats the run, the dispatcher keeps waiting. Thread metadata, which API clients can write, plays no part in deciding how a run ended.
