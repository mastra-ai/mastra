---
'@mastra/core': patch
---

Fixed EventedAgent leaving finished runs' snapshot rows in storage. Completed runs no longer show up in listActiveRuns() or get re-executed by recoverActiveRuns() (#22209). The evented workflow engine now also deletes a run's snapshot row when it reaches a non-paused terminal status that the workflow's shouldPersistSnapshot option declined to persist, instead of leaving a stale row behind.
