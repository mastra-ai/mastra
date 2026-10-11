---
'@mastra/libsql': patch
---

Fixed `SQLITE_BUSY: database is locked` errors when more than one LibSQL client in the same process uses the same local database file, for example a `Memory` with its own `LibSQLStore` pointing at the file Mastra's storage uses. A write from one client no longer blocks the process while another client's transaction is open; it waits for that transaction to finish instead.
