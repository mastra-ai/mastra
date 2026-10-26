---
'@mastra/pg': patch
---

Fixed `PostgresStoreVNext` failing to initialize with "permission denied for database" when the database role can create tables in the target schema but cannot create schemas. The observability store now checks whether the schema exists before running `CREATE SCHEMA`, matching `PostgresStore`.
