---
'@mastra/core': patch
---

Fixed workflow recovery restarting a run that is still executing, which ran its steps twice. `startAsync()` now takes the run's lease before it saves the first snapshot, so it resolves after the lease is taken and rejects if taking it fails. Runs of workflows whose `shouldPersistSnapshot` saves `waiting` but not `running` now hold a lease too, so recovery no longer restarts them while they execute or sleep.
