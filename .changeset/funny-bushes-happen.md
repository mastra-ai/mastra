---
'@mastra/libsql': patch
---

Added storage-level filtering for `Agent.listSuspendedRuns()` thread lookups. The thread id embedded in suspended run snapshots is now filtered inside SQLite instead of loading every suspended snapshot into the application. Part of https://github.com/mastra-ai/mastra/issues/22627
