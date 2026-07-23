---
'mastracode': patch
---

Fixed local database corruption on exit by closing storage connections during TUI shutdown. The signal handler (SIGINT, SIGTERM, SIGHUP) now calls storage close, which checkpoints and truncates WAL files and switches back to DELETE journal mode before the process exits. Previously, abrupt termination left WAL sidecars un-checkpointed, which could corrupt the local SQLite database on the next open.
