---
'@mastra/libsql': minor
---

Added the `signalSubscriptions` storage domain to `LibSQLStore`. Signal provider subscriptions and webhook delivery records now persist across restarts and are shared by every process that uses the same database.
