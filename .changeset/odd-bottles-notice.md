---
'@mastra/libsql': patch
---

Fixed background task updates and deletes on a local LibSQL file database stalling for up to five seconds (and sometimes failing with `SQLITE_BUSY: database is locked`) when they ran alongside workflow run writes, for example while shutting down Mastra with background tasks still running.
