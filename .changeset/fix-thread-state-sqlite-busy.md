---
'@mastra/libsql': patch
---

ThreadState storage domain now uses write serialization and automatic retry on SQLITE_BUSY errors, preventing lost writes when concurrent agent operations access the same LibSQL database.
