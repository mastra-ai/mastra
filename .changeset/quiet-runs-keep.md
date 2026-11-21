---
'@mastra/core': minor
'@mastra/pg': patch
'@mastra/libsql': patch
---

Fixed an evented workflow run's suspend cleanup deleting a record it did not write. A run whose `shouldPersistSnapshot` declines its suspended snapshot deletes the temporary record it stored while running. It used to delete whatever was stored under the run ID, so a cancellation that landed while the run was suspending, or a newer execution that stored the same run ID, was lost. The record is now deleted only while it is still running and is still the one this execution stored, checked atomically with the delete. Storage adapters can opt in to the new optional `expectedStatus` and `expectedGuardedOnlySnapshotId` guards on `deleteWorkflowRunById` by returning `true` from `supportsGuardedRunDeletes()` (in-memory, Postgres and LibSQL do); `deleteWorkflowRunById` still resolves to `void`. On other adapters the record is kept.
