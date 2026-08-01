---
'@mastra/pg': patch
---

Improved PostgresStore startup: init now reads the schema catalog up front (3 read-only queries) instead of issuing hundreds of per-object existence checks and no-op DDL statements. On an already-migrated database this cuts init from ~350 serialized queries to 6, dropping init time on a 50ms connection from ~18.5s to ~0.5s. Fixed init failing for roles without CREATE privileges when the schema already exists, and removed a table lock that could block writers while init re-created triggers that were already in place. Fresh and partially-migrated databases are set up exactly as before.
