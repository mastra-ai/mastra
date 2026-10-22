---
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed default workflow runs continuing to later steps and overwriting their status with success after another process canceled the run through shared storage.

Workflow stores can now reject a snapshot write when the run's persisted status has changed, by passing `expectedStatus` to `persistWorkflowSnapshot` and reporting support through `supportsGuardedSnapshotWrites()`. The in-memory and LibSQL stores do this in a single atomic write, so a cancel can no longer land between the engine's check and its write. Stores also gain `loadWorkflowRunStatus()`, which reads only a run's status; LibSQL and in-memory override it, and other stores fall back to loading the snapshot.
