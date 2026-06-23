---
'@mastra/core': patch
---

Fixed conditional workflows so that re-running or rehydrating a run (time travel) no longer leaves the wrong branch marked as active. When a paused or replayed run lands on a conditional, arms whose condition does not evaluate truthy are now correctly recorded as skipped instead of staying stuck in a running state.
