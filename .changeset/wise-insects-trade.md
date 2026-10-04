---
'@mastra/libsql': patch
---

Fixed observational memory losing buffered observations or activated context when reflections, observation activation, and background buffering overlap, including from several processes sharing one database file. Observational memory writes no longer hold a database transaction open, which also fixes `SQLITE_BUSY: database is locked` errors when observational memory and message saves ran at the same time against a local file database. With Turso embedded replicas (`syncUrl`), an observational memory write that conflicts with another instance syncs the replica before retrying.

**Upgrading.** A nullable `supersededBy` column is added to the observational memory table automatically at startup. Existing rows are backfilled at the next startup of any process, so older generations stop accepting writes. Protection is complete once every process that shares the database runs the new version; older versions running alongside it neither set nor check the new column.
