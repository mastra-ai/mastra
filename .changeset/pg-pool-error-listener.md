---
'@mastra/pg': patch
---

Fixed an issue where the process could crash when Postgres drops an idle database connection (e.g., due to a backend restart, failover, or network failure).

Previously, a dropped idle connection caused an uncaught exception that terminated the process. Now the connection drop is caught and logged as a warning, and the store automatically reconnects on the next database operation.

User-provided connection pools are unaffected and keep their existing error handling.
