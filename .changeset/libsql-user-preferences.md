---
'@mastra/libsql': patch
---

Added support for the `userPreferences` storage domain in `LibSQLStore`. Projects using LibSQL as their default storage now persist per-user starred agents, starred skills, and UI preferences without needing a separate storage adapter.
