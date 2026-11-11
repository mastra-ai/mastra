---
'@mastra/core': patch
---

Improved the boot-time workflow restart (`restartAllActiveWorkflowRuns()`) for deployments with many active runs (#28712). It now reads active runs a page at a time instead of all at once, and skips runs another instance is still running without loading them. Each skipped run is checked again once that instance's lease could have expired. Evented runs no longer hold a `recovery.workflowConcurrency` slot until they finish, so a long evented run no longer delays the restart of the others.

Storage adapters can implement `getRunOwnerships({ runIds })` to read the ownership of many runs in one call. Adapters that don't implement it read the runs one at a time.
