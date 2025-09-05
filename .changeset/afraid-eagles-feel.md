---
'@mastra/pg': patch
---

Fix PgVector listIndexes() to only return Mastra-managed tables instead of all tables with vector columns. This prevents initialization failures when other pgvector tables exist in the database.
