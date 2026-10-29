---
'@mastra/core': patch
---

Durable agents now keep their `isTaskComplete` check when a run is recovered after a crash. Previously a run resumed with `recover()`, `recoverActiveRuns()`, or `recovery: { durableAgents: 'auto' }` finished without running the completion scorers. Recovery now restores the agent's `defaultOptions.isTaskComplete`. Scorers passed per call can't be restored after a restart, so recovery logs a warning naming the run instead of skipping the check silently.
