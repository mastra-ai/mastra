---
'@mastra/libsql': patch
---

Fixed workers failing to start when several of them upgrade the same libSQL database at once. A worker that finds a missing column already added by another worker now continues instead of failing `init` with `duplicate column name`.
