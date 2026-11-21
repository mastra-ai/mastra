---
'@mastra/core': patch
---

Fixed memory growth from workflow runs that suspend and are never resumed. A suspended run is now dropped from memory once its suspension is saved to storage, and resuming it rebuilds it from the saved snapshot, in the same process or a new one. While your code still holds a run, `createRun({ runId })` returns that same run, so watchers and `cancel()` keep working across handles.
