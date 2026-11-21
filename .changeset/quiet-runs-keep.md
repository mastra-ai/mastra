---
'@mastra/core': minor
'@mastra/pg': patch
'@mastra/libsql': patch
---

Fixed a cancellation being lost when it lands while an evented workflow run is suspending. A run whose `shouldPersistSnapshot` declines its suspended snapshot used to delete its temporary record even if the run had just been canceled; the record is now deleted only while it is still running, checked atomically with the delete, so the canceled run stays stored. Storage adapters can opt in to a new optional `expectedStatus` guard on `deleteWorkflowRunById` by returning `true` from `supportsGuardedRunDeletes()` (in-memory, Postgres and LibSQL do); `deleteWorkflowRunById` still resolves to `void`. On other adapters the record is kept.
