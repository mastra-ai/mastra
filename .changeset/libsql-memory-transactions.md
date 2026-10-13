---
'@mastra/libsql': patch
---

Fixed `LibSQLFactoryStorage.withTransaction` on `:memory:` databases. It ran the callback without a transaction, so a write that failed partway left the earlier writes in place. It now commits or rolls back like a file database.
