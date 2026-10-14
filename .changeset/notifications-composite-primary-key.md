---
'@mastra/pg': patch
'@mastra/libsql': patch
---

Fixed `mastra_notifications` being created without its `("threadId", "id")` primary key. Without it, duplicate notification ids could be stored, and on PostgreSQL the table had no replica identity, so updates and deletes failed when the table was part of a logical replication publication.

New tables now get the key, and `exportSchemas()` includes it. Existing tables are upgraded the next time storage initializes: PostgreSQL adds the primary key, and LibSQL adds a unique index on the same columns. If the key cannot be added because an existing table already contains duplicate rows, or because the database role does not own the table, initialization still succeeds and logs a warning with the SQL needed to add the key.
