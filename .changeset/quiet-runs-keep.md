---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
---

Fixed a cancellation being lost when it lands while an evented workflow run is suspending. A run whose `shouldPersistSnapshot` declines its suspended snapshot used to delete its temporary record even if the run had just been canceled; the record is now deleted only while it is still running, checked atomically with the delete, so the canceled run stays stored. Storage adapters can opt in to the new `expectedStatus` guard on `deleteWorkflowRunById` by returning `true` from `supportsGuardedRunDeletes()` (in-memory, Postgres and LibSQL do); on other adapters the record is kept.
