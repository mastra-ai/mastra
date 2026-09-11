---
'@mastra/libsql': patch
---

Fixed file-level write coordination between `LibSQLStore` and `LibSQLVector` sharing one local database file. Store transactions now hold the same path-keyed write lock that vector mutations already use, so an interrupted `BEGIN IMMEDIATE` can no longer poison a pooled connection and fail every later `COMMIT` with `SQLITE_BUSY: cannot commit transaction - SQL statements in progress`. `saveMessages` also runs inside the per-client write lock like every other Memory write.
