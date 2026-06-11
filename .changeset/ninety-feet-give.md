---
'@mastra/core': patch
---

Fixed PostgresStore initialization failing with `canceling statement due to statement timeout` on `mastra_ai_spans` when running behind transaction poolers (e.g. Supabase, pgBouncer). Domain `init()` calls inside composite stores now run sequentially so only one DDL statement is in flight at a time, instead of fanning out hundreds of concurrent `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` calls across the pool. Fixes #17679.
