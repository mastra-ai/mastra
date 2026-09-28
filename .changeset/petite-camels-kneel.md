---
'@mastra/pg': patch
---

Fixed duplicate observational memory records in PostgreSQL when several agents, Memory instances, or server processes start or reflect on the same thread or resource at the same time ([#22188](https://github.com/mastra-ai/mastra/issues/22188)). Only one record is now created per generation, and every caller gets that same record back. This works behind transaction-mode connection poolers such as PgBouncer and Supabase.

No schema change or migration is needed. Databases that already contain duplicate records keep working: Mastra now always reads the same one (the earliest created) instead of switching between them.
