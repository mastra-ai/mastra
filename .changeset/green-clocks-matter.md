---
'@mastra/memory': patch
---

Fixed observational memory search scanning the whole vector table on PostgreSQL. The observation index now gets the same `resource_id` and `thread_id` metadata indexes that semantic recall already uses. Existing tables get them automatically the first time observational memory runs after upgrading. If you set `disableInit` on `PgVector`, create them yourself for each `memory_observations_*` table:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS memory_observations_1536_resource_id_idx ON memory_observations_1536 ((metadata->>'resource_id'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS memory_observations_1536_thread_id_idx ON memory_observations_1536 ((metadata->>'thread_id'));
```
