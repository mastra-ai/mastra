---
'@mastra/pg': patch
---

PostgreSQL `disableInit` mode now propagates through native storage domains. Startup remains zero-I/O, and lazy table and index helpers validate externally managed tables and indexes through read-only catalog queries without issuing schema DDL. `disableInit: true` keeps `PgDB`'s explicit schema migration helpers disabled; the initialization environment flag still permits the explicit privileged migration CLI path. Missing required structure fails with the existing typed storage operation error.

Read-only catalog results are reused by each domain instance; complete external migrations before constructing runtime stores and reconstruct affected storage instances after schema changes. Privileged migrations must recreate any older schema-prefixed indexes whose names were silently truncated by PostgreSQL so runtime validation sees the canonical hash-suffixed names.
