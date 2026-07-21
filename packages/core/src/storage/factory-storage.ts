/**
 * FactoryStorage — a pluggable application-storage backend contract.
 *
 * One `FactoryStorage` instance powers both sides of an application
 * deployment's persistence:
 *
 * - **Agent state** (threads, messages, memory, observational memory) via
 *   {@link FactoryStorage.getMastraStorage}, which callers feed to the
 *   Mastra instance and all agent-related wiring.
 * - **App tables** (application-owned collections: settings, audit trails,
 *   work items, integration state, ...) via the generic
 *   {@link FactoryStorageOps} query surface plus declarative
 *   {@link CollectionSchema} DDL mapping.
 *
 * App-table domains are written once against `ops`; backends implement the
 * small query surface once (M + N, not M × N). Nothing outside a backend
 * implementation may branch on the database dialect — optional capabilities
 * ({@link FactoryStorage.withDistributedLock},
 * {@link FactoryStorage.authDatabase}) are feature-gated on presence.
 *
 * Contract discipline: the ops surface is deliberately small — equality-filter
 * CRUD, conflict-key upsert, ordered/limit/keyset-cursor lists, and atomic
 * read-modify-write. Anything not expressible here is a deliberate, reviewed
 * contract extension — never raw SQL from a domain.
 *
 * Store packages (`@mastra/pg`, `@mastra/libsql`) ship implementations next
 * to their `MastraCompositeStore` adapters, sharing one connection between
 * agent state and app tables.
 */

import type { MastraCompositeStore } from './base';
import { StorageDomain } from './domains/base';

/** Values storable in (and filterable on) a collection column. */
export type CollectionValue = string | number | boolean | Date | null;

/**
 * Row filter: column → required value. Multiple entries AND together.
 * - A {@link CollectionValue} matches by equality; `null` matches SQL `IS NULL`.
 * - `{ in: [...] }` matches any of the listed values (SQL `IN`).
 * - `{}` matches every row.
 *
 * Column names must be declared in the collection's schema — backends reject
 * unknown collections/columns instead of interpolating them.
 */
export type CollectionWhere = Record<string, CollectionValue | { in: CollectionValue[] }>;

/**
 * Keyset cursor for stable pagination: the `orderBy` column values of the
 * last row of the previous page, in the same order as `orderBy`. The next
 * page contains rows strictly after that position in the sort order.
 */
export interface CollectionCursor {
  values: CollectionValue[];
}

export interface CollectionListOptions {
  /** Sort order; required when `cursor` is set. */
  orderBy?: [column: string, dir: 'asc' | 'desc'][];
  limit?: number;
  /** Keyset cursor over the `orderBy` columns (see {@link CollectionCursor}). */
  cursor?: CollectionCursor;
}

/**
 * Closed column-type union, mapped to backend-native types.
 *
 * `uuid-pk` declares the collection's generated primary key: the ops layer
 * assigns a UUID client-side on insert when the caller doesn't provide one,
 * so every backend produces identical rows. A collection may instead mark one
 * caller-supplied column with `primaryKey: true` (natural keys, e.g. a
 * session id).
 *
 * Value normalization is part of the contract regardless of dialect:
 * `timestamp` columns round-trip as `Date`, `json` as parsed values,
 * `boolean` as booleans, and `bigint` as JS numbers (safe integers — e.g.
 * GitHub ids fit well inside 2^53).
 */
export type CollectionColumnType = 'text' | 'bigint' | 'integer' | 'boolean' | 'json' | 'timestamp' | 'uuid-pk';

export interface CollectionColumnSpec {
  type: CollectionColumnType;
  /** Columns are NOT NULL unless marked nullable. */
  nullable?: boolean;
  /**
   * Natural primary key (caller-supplied on insert). Mutually exclusive with
   * a `uuid-pk` column; exactly one primary key per collection.
   */
  primaryKey?: boolean;
  /**
   * DDL-level default literal. Required when additively introducing a
   * NOT NULL column to a collection that may already have rows (e.g.
   * `actor_type text NOT NULL DEFAULT 'human'`).
   */
  default?: string | number | boolean;
}

/**
 * Unique index. The optional partial forms cover the two shapes app schemas
 * need: `whereNotNull` (unique per non-null natural key) and `whereNull`
 * (unique per scope where an owner column is absent).
 */
export interface CollectionUniqueIndexSpec {
  name: string;
  columns: string[];
  /** Index only rows where this column IS NOT NULL. */
  whereNotNull?: string;
  /** Index only rows where this column IS NULL. */
  whereNull?: string;
}

export interface CollectionIndexSpec {
  name: string;
  columns: string[];
}

/**
 * Declarative collection definition, mapped to backend DDL by
 * {@link FactoryStorage.ensureCollections}. Evolution is additive only:
 * re-running with new columns/indexes adds them; nothing is dropped or
 * retyped.
 */
export interface CollectionSchema {
  name: string;
  /** Column name → spec. Rows returned by ops are keyed by these names. */
  columns: Record<string, CollectionColumnSpec>;
  uniqueIndexes?: CollectionUniqueIndexSpec[];
  indexes?: CollectionIndexSpec[];
}

/**
 * Tagged database handle for auth libraries (e.g. better-auth). Consumers
 * narrow on `dialect` to build their driver adapter — a supported contract,
 * unlike sniffing store internals. `custom` passes an adapter/instance the
 * auth library accepts as-is.
 */
export type FactoryAuthDatabase =
  | { dialect: 'postgres'; pool: unknown }
  | { dialect: 'libsql'; client: unknown }
  | { dialect: 'custom'; database: unknown };

/**
 * Thrown by `insertOne`/`upsertOne` when a unique constraint rejects the row.
 * Backends map their native duplicate-key errors onto this type so domains
 * can implement insert-or-recover races portably.
 */
export class UniqueViolationError extends Error {
  readonly collection: string;

  constructor(collection: string, options?: { cause?: unknown }) {
    super(`Unique constraint violation on collection '${collection}'`, options);
    this.name = 'UniqueViolationError';
    this.collection = collection;
  }
}

/**
 * The generic query surface app-table domains are written against.
 *
 * Rows (`T`) are plain objects keyed by schema column names; domains own any
 * mapping to their public camelCase shapes. All methods throw if the
 * collection (or any referenced column) was not registered via
 * `ensureCollections`.
 */
export interface FactoryStorageOps {
  findOne<T extends Record<string, unknown>>(collection: string, where: CollectionWhere): Promise<T | null>;

  findMany<T extends Record<string, unknown>>(
    collection: string,
    where: CollectionWhere,
    opts?: CollectionListOptions,
  ): Promise<T[]>;

  /**
   * Insert one row, returning it (with the generated `uuid-pk` populated).
   * Throws {@link UniqueViolationError} on any unique-constraint conflict.
   */
  insertOne<T extends Record<string, unknown>>(collection: string, row: Partial<T>): Promise<T>;

  /**
   * Insert, or update the existing row that matches `conflictKeys` (which
   * must be covered by a unique index). Non-key columns present in `row`
   * replace the stored values; the existing primary key is preserved.
   */
  upsertOne<T extends Record<string, unknown>>(collection: string, conflictKeys: string[], row: Partial<T>): Promise<T>;

  /** Set columns on every matching row. Returns the number of rows updated. */
  updateMany(collection: string, where: CollectionWhere, set: Record<string, unknown>): Promise<number>;

  /** Delete every matching row. Returns the number of rows deleted. */
  deleteMany(collection: string, where: CollectionWhere): Promise<number>;

  /**
   * Atomic read-modify-write of one matching row. `fn` receives the current
   * row and returns the columns to set — or `null` to abort without writing
   * (the unmodified row is returned; use a closure flag to distinguish abort
   * from success). Returns `null` when no row matches.
   *
   * Isolation: pg runs `fn` inside a `SELECT ... FOR UPDATE` transaction;
   * libsql serializes through its single-writer path. Either way, concurrent
   * `updateAtomic` calls on the same row never lose each other's writes.
   */
  updateAtomic<T extends Record<string, unknown>>(
    collection: string,
    where: CollectionWhere,
    fn: (row: T) => Partial<T> | null | Promise<Partial<T> | null>,
  ): Promise<T | null>;
}

/**
 * Base class for application domains owned by a {@link FactoryStorage}.
 * Domains are bound once when registered and share their owner's connection.
 */
export abstract class FactoryStorageDomain extends StorageDomain {
  override readonly name: string;
  #storage?: FactoryStorage;

  protected constructor(name: string) {
    if (!name.trim()) {
      throw new Error('Factory storage domain name must not be empty');
    }
    super({ component: 'STORAGE', name });
    this.name = name;
  }

  /** @internal Bound by {@link FactoryStorage.registerDomain}. */
  __bindFactoryStorage(storage: FactoryStorage): void {
    if (this.#storage && this.#storage !== storage) {
      throw new Error(`Factory storage domain '${this.name}' is already bound to another storage instance`);
    }
    this.#storage = storage;
  }

  protected get storage(): FactoryStorage {
    if (!this.#storage) {
      throw new Error(`Factory storage domain '${this.name}' has not been registered`);
    }
    return this.#storage;
  }

  protected get ops(): FactoryStorageOps {
    return this.storage.ops;
  }

  protected ensureCollections(schemas: CollectionSchema[]): Promise<void> {
    return this.storage.ensureCollections(schemas);
  }
}

/**
 * A pluggable application-storage backend: one database powering agent state
 * (via {@link getMastraStorage}) and app-owned collections (via {@link ops}).
 */
export abstract class FactoryStorage {
  readonly #domains = new Map<string, FactoryStorageDomain>();
  readonly #readyDomains = new Set<string>();
  readonly #domainErrors = new Map<string, unknown>();
  readonly #domainInitPromises = new Map<string, Promise<void>>();
  #storageReady = false;
  #storageInitPromise?: Promise<void>;

  /**
   * Agent-state store (threads, messages, memory, OM) for this database,
   * sharing this backend's connection. Callers pass the result to the Mastra
   * instance and all agent-related wiring. Lazily constructed; returns the
   * same instance on repeat calls.
   */
  abstract getMastraStorage(): MastraCompositeStore;

  /** Open/validate the backend, then initialize registered domains fail-soft. */
  async init(): Promise<void> {
    await this.#ensureStorageReady();
    await Promise.all([...this.#domains.keys()].map(name => this.#initDomain(name).catch(() => undefined)));
  }

  /** Backend-specific connection initialization. */
  protected abstract initStorage(): Promise<void>;

  registerDomain<T extends FactoryStorageDomain>(domain: T): T {
    if (this.#domains.has(domain.name)) {
      throw new Error(`Factory storage domain '${domain.name}' is already registered`);
    }
    domain.__bindFactoryStorage(this);
    this.#domains.set(domain.name, domain);
    return domain;
  }

  getDomain<T extends FactoryStorageDomain = FactoryStorageDomain>(name: string): T {
    const domain = this.#domains.get(name);
    if (!domain) {
      throw new Error(`Factory storage domain '${name}' is not registered`);
    }
    return domain as T;
  }

  hasDomain(name: string): boolean {
    return this.#domains.has(name);
  }

  domainNames(): string[] {
    return [...this.#domains.keys()];
  }

  isDomainReady(name: string): boolean {
    return this.#readyDomains.has(name);
  }

  domainInitError(name: string): unknown {
    return this.#domainErrors.get(name);
  }

  async ensureDomainReady(name: string): Promise<void> {
    this.getDomain(name);
    await this.#ensureStorageReady();
    await this.#initDomain(name);
  }

  /**
   * Map each domain's declarative schema to backend DDL. Idempotent and
   * additive: safe to re-run, never drops or retypes anything. Registers the
   * schemas so `ops` can validate identifiers and normalize values.
   */
  abstract ensureCollections(schemas: CollectionSchema[]): Promise<void>;

  /** The generic query surface domains are written against. */
  abstract readonly ops: FactoryStorageOps;

  /** Release the backend's connections (tests, shutdown). */
  abstract close(): Promise<void>;

  // ---- optional capabilities (feature-gate on presence, never on dialect) ----

  /**
   * Cross-replica serialization (pg: advisory locks). Absent → the backend
   * has no multi-replica story and in-process locking is sufficient.
   */
  withDistributedLock?<T>(key: string, fn: () => Promise<T>): Promise<T>;

  /**
   * A tagged database handle auth libraries can consume (see
   * {@link FactoryAuthDatabase}). Absent → auth integrations require a
   * user-provided instance.
   */
  authDatabase?(): FactoryAuthDatabase;

  async #ensureStorageReady(): Promise<void> {
    if (this.#storageReady) return;
    if (this.#storageInitPromise) return this.#storageInitPromise;

    const initPromise = (async () => {
      await this.initStorage();
      this.#storageReady = true;
    })();
    this.#storageInitPromise = initPromise;

    try {
      await initPromise;
    } finally {
      if (this.#storageInitPromise === initPromise) {
        this.#storageInitPromise = undefined;
      }
    }
  }

  #initDomain(name: string): Promise<void> {
    if (this.#readyDomains.has(name)) return Promise.resolve();
    const pending = this.#domainInitPromises.get(name);
    if (pending) return pending;

    const domain = this.getDomain(name);
    this.#domainErrors.delete(name);
    const initPromise = (async () => {
      try {
        await domain.init();
        this.#readyDomains.add(name);
      } catch (error) {
        this.#domainErrors.set(name, error);
        throw error;
      } finally {
        this.#domainInitPromises.delete(name);
      }
    })();
    this.#domainInitPromises.set(name, initPromise);
    return initPromise;
  }
}
