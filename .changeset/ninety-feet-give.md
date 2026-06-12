---
'@mastra/pg': patch
---

Fix `PostgresStore` startup failing with `canceling statement due to statement timeout` when running behind a transaction pooler such as Supabase or PgBouncer. Initialization now reuses a single pooled connection for the duration of startup, so storage initializes reliably with observability enabled. Runtime queries are unaffected. Fixes #17679.
