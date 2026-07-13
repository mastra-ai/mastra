---
'@mastra/libsql': minor
---

Added `LibSQLVector.close()` to release the underlying libsql client. For local file databases it checkpoints the WAL and switches back to `journal_mode=DELETE` before closing (mirroring `LibSQLStore.close()`), so the `-wal`/`-shm` sidecar files and OS handles are released promptly. Safe to call more than once.
