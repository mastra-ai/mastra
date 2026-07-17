/**
 * Contract for factory-owned application-table storage domains.
 *
 * App tables (intake settings, audit events, work items, and
 * integration-provided tables like github/linear) follow the core/storage
 * domain pattern: an abstract base class declares the typed query surface,
 * and a backend implementation owns its DDL. Domains are registered on the
 * {@link FactoryStore} registry — built-ins and integration-provided domains
 * flow through the exact same `register()` path — and are initialized once by
 * `MastraFactory.prepare()` after the injected Mastra storage's own `init()`.
 */

import type pg from 'pg';

/**
 * Connection handle passed to each domain's `init()`.
 *
 * PG-only for now: the shared pool comes from the `PostgresStore` injected
 * into `MastraFactory`, so app tables and Mastra's own storage share one
 * connection pool. The contract is deliberately a context object rather than
 * a bare pool so future backends (libsql, mongodb) can extend it without
 * changing the domain interface.
 */
export interface FactoryStorageContext {
  /** Shared pg pool from the factory's injected storage. */
  pool: pg.Pool;
}

/**
 * One factory app-table domain.
 *
 * `init()` owns the domain's idempotent DDL (the old per-domain
 * `MIGRATION_SQL` + `ensureXyzDbReady()` latches) and binds the domain to the
 * shared connection. It must be safe to call repeatedly — `FactoryStore`
 * retries a failed init on the next `ensureReady()` call.
 */
export interface FactoryStorageDomain {
  /** Unique registry key, e.g. 'intake', 'audit', 'work-items', 'github'. */
  readonly name: string;
  /** Run idempotent DDL and bind to the shared connection. */
  init(ctx: FactoryStorageContext): Promise<void>;
}
