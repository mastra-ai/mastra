---
'@mastra/memory': patch
---

Fixed observational memory search scanning the whole vector table on PostgreSQL. The observation index now gets `resource_id` and `thread_id` metadata indexes, like semantic recall. Existing tables get them on the first run after upgrading. With `disableInit` on `PgVector`, create them yourself for each `memory_observations_*` table:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS memory_observations_1536_resource_id_idx ON memory_observations_1536 ((metadata->>'resource_id'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS memory_observations_1536_thread_id_idx ON memory_observations_1536 ((metadata->>'thread_id'));
```
