---
'@mastra/pg': patch
---

Fixed PostgresStore initialization failing with `canceling statement due to statement timeout` on `mastra_ai_spans` when running behind transaction poolers (e.g. Supabase, pgBouncer). `PostgresStore.init()` now pins all domain DDL (`CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX`) to a single pooled backend connection for the duration of initialization, instead of fanning out hundreds of concurrent statements across the pool. This eliminates pooler-budget exhaustion and inter-statement lock contention without changing runtime behavior. Fixes #17679.
