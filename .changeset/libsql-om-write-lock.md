---
'@mastra/libsql': patch
---

Fixed data loss and corruption in observational memory when it is written to concurrently on a local SQLite database. Buffered observations could previously be dropped or leave the memory record in an inconsistent state under load; memory updates are now serialized so concurrent writes are preserved.
