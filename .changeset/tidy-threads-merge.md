---
'@mastra/libsql': patch
---

Fixed thread metadata updates dropping keys when two writers update the same thread at once, whether in one process or across processes. Concurrent `updateThread` and `updateThreadMetadata` calls now keep every key. LibSQL domains built with a `url` now wrap their local file client the way `LibSQLStore` does, so two clients on one database file no longer stall each other into a `SQLITE_BUSY` error. Closing an in-memory or embedded-replica client while a transaction is open, or a statement that rolls the transaction back, no longer leaves other calls on that client waiting forever.
