---
'@mastra/pg': patch
---

Improved `PostgresStore` startup time on a database that has not been set up yet. Creating the schema for the first time issued one `CREATE INDEX CONCURRENTLY` per default index — 48 statements, each its own round trip on the single connection `init()` reserves. Indexes for tables that `init()` just created are now built in one batched statement without `CONCURRENTLY`, which is safe because those tables are brand new and empty. First-run init drops from 99 round trips to 49; against a Postgres with 25ms of latency that is roughly 4.2s down to 2.2s.

Indexes added later to a table that already exists still use `CONCURRENTLY`, so a version upgrade that introduces an index never blocks writers on a populated table. An already-migrated database still initializes in 6 queries, unchanged. If one index fails to build, the rest are still created.

`init()` also no longer releases its pinned connection while a storage domain is still setting up, so an init that fails partway can no longer leave DDL running on a separate pooled connection after it returns.

Related to [#21676](https://github.com/mastra-ai/mastra/issues/21676).
