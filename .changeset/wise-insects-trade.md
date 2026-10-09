---
'@mastra/libsql': patch
---

Fixed observational memory losing context when several operations run at the same time.

- Buffered observations and activated context are no longer lost when reflection, activation, and background buffering overlap, even across processes that share one database file.
- Fixed `SQLITE_BUSY: database is locked` errors when observational memory and message saves run at the same time on a local file database.
- With Turso embedded replicas (`url` plus `syncUrl`), an observational memory write syncs the replica before it retries after a conflict, or before it treats a record another instance created as missing. This does not apply to a prebuilt `client`.

**Upgrading.** A nullable `supersededBy` column is added to the observational memory table automatically at startup. Existing rows are backfilled at the next startup of any process, so older generations stop accepting writes. Protection is complete once every process that shares the database runs the new version; older versions running alongside it neither set nor check the new column.

If you manage the schema yourself (`disableInit: true` or `MASTRA_DISABLE_STORAGE_INIT=true`), startup does not run this migration. Add a nullable `supersededBy` column, of the same type as `id`, to `mastra_observational_memory` before you upgrade, or reflections and buffered activation fail with a missing-column error.
