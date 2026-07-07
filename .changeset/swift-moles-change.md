---
'mastracode': minor
---

Added storage retention and a new `/prune` command to keep the local database from growing without bound.

**Default retention policies** are now applied to Mastra Code storage: chat messages and threads are kept for 90 days, observability spans and logs for 14 days, scores and workflow snapshots for 30 days. Rows older than these limits are only removed when you run `/prune` — nothing is deleted automatically.

**New `/prune` command:**

- `/prune` closes the TUI, hands the terminal over to a maintenance run that deletes rows older than the retention policies with live progress output, then exits (start `mastracode` again for a new session)
- `/prune vacuum` additionally compacts local libsql database files to return the freed space to your disk, and reports the reclaimed size. Compaction streams a `VACUUM INTO` copy and swaps it into place — bounded memory and no WAL growth even on multi-GB databases — and refuses to start without enough free disk space for the copy
- Compaction proves it has exclusive access to each database file before swapping. If another Mastra Code session still has the file open, `/prune vacuum` refuses with a clear message instead of silently orphaning that session's writes

Maintenance runs outside the TUI so retention deletes and `VACUUM` never contend with a live session for the database.

Also, when local tracing is disabled, observability data is no longer written to the libsql database at all.
