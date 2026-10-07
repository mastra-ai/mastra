---
'@mastra/libsql': patch
---

Fixed local libSQL file databases staying blocked for seconds after a write was refused with `SQLITE_BUSY`. Later writes failed with "SQL statements in progress" until the stuck connection was garbage collected. `LibSQLStore` now reopens its connections after a busy refusal, including when it is under constant load.
