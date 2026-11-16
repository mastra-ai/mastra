---
'@mastra/factory': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed factory storage on existing databases after a column is removed from a collection schema. The column is no longer required, so new rows that leave it out are accepted, and the values already stored in it are kept. Previously, LibSQL could also discard such a column's data while rebuilding a table.
