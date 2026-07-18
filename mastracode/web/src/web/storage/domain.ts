/**
 * Contract for factory-owned application-table storage domains.
 *
 * App tables (intake settings, audit events, work items, and
 * integration-provided tables like github/linear) follow the core/storage
 * domain pattern: a domain declares its collections with a declarative
 * {@link CollectionSchema} and talks to the database exclusively through the
 * generic `FactoryStorageOps` surface — never raw SQL, never a dialect
 * branch. Domains are registered on the {@link DomainRegistry} — built-ins
 * and integration-provided domains flow through the exact same `register()`
 * path — and are initialized once by `MastraFactory.prepare()` after the
 * factory storage's own `init()`.
 */

import type { FactoryStorage } from '@mastra/core/storage';

/**
 * Connection handle passed to each domain's `init()`.
 *
 * Carries the pluggable {@link FactoryStorage} backend so app tables and
 * Mastra's own agent-state storage share one database connection. Domains
 * call `storage.ensureCollections()` for their DDL and keep `storage.ops`
 * for queries.
 */
export interface FactoryStorageContext {
  /** The factory's pluggable storage backend. */
  storage: FactoryStorage;
}

/**
 * One factory app-table domain.
 *
 * `init()` maps the domain's declarative schema to backend DDL (via
 * `ensureCollections`) and binds the domain to the shared backend. It must be
 * safe to call repeatedly — `DomainRegistry` retries a failed init on the
 * next `ensureReady()` call.
 */
export interface FactoryStorageDomain {
  /** Unique registry key, e.g. 'intake', 'audit', 'work-items', 'github'. */
  readonly name: string;
  /** Ensure collections exist and bind to the shared backend. */
  init(ctx: FactoryStorageContext): Promise<void>;
}
