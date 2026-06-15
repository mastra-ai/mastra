---
'@mastra/libsql': patch
---

Fixed ThreadState LibSQL writes by adding write serialization and automatic SQLITE_BUSY retries, preventing lost writes when concurrent agent operations access the same LibSQL database.
