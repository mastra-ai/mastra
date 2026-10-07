---
'@mastra/core': patch
---

Fixed aborted suspended runs staying listed as suspended. When `session.abort()` cancels a run that is parked in a tool `suspend()` (for example `ask_user`), the run's in-memory registration and its workflow snapshot rows are now released, so `agent.listSuspendedRuns()` no longer returns it and memory no longer grows with each aborted run. This applies to both regular and durable agents.
