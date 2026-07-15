---
'@mastra/pg': patch
---

Attach `'error'` listeners to the `pg.Pool` instances `@mastra/pg` creates (PgVector, PostgresStore primary and vNext observability pools, and standalone domain pools from `resolvePgConfig`).

When Postgres drops an **idle** pooled connection (backend restart, failover, network partition, cloud proxies reaping idle sockets), `pg` emits `'error'` on the pool. With no listener attached, Node escalates that event to an `uncaughtException` and crashes the process (`Error: read ECONNRESET` at `TCP.onStreamRead`). The pool already discards the dead client, so the listener logs a warning and the next checkout reconnects.

Pools supplied by the caller (`{ pool }` configs) are not touched — their error handling stays with their owner, mirroring `close()` semantics.
