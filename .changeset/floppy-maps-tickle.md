---
'@mastra/memory': patch
---

Fixed observational memory stopping an agent run with `SQLITE_BUSY: database is locked` when another process briefly held the database lock. Storage calls made by observational memory now retry lock-contention errors (SQLite busy/locked, Postgres serialization, deadlock, and lock-timeout errors) a few times with backoff before failing.
