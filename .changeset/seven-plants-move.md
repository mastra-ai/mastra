---
'@mastra/pg': patch
---

Fixed a crash where losing the database connection while a client was checked out (idle between queries) would terminate the host process.

pg emits an `'error'` event on the **client** (not the pool) when a checked-out client's backend connection dies while idle — e.g. an idle-connection timeout from a pooler (Supavisor/PgBouncer) or NAT, a backend restart, or `pg_terminate_backend`. During a checkout node-postgres removes its own pool-level error listener from that client, so with no client-level listener Node escalated the event to an uncaughtException and crashed the process. This affected long-held checkouts such as `PostgresStore` initialization (all DDL is pinned to one client), transactions, and `PgVector` operations.

Every checkout `@mastra/pg` hands out now attaches an `'error'` handler for the lifetime of the checkout: the dead client is discarded and a recoverable error is surfaced instead of crashing the process.
