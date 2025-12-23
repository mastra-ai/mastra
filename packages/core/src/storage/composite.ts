import { MastraStorage, type StorageDomains } from './base';
import type { StorageSupports } from './types';

/**
 * Configuration for individual domain overrides in CompositeStorage.
 * Each domain can be sourced from a different storage adapter.
 */
export type CompositeStorageDomains = Partial<StorageDomains>;

/**
 * Configuration options for CompositeStorage.
 */
export interface CompositeStorageConfig {
  /**
   * Unique identifier for this storage instance.
   */
  id: string;

  /**
   * Default storage adapter to use for domains not explicitly specified.
   * If provided, domains from this storage will be used as fallbacks.
   */
  default?: MastraStorage;

  /**
   * Individual domain overrides. Each domain can come from a different storage adapter.
   * These take precedence over the default storage.
   *
   * @example
   * ```typescript
   * domains: {
   *   memory: pgStore.stores?.memory,
   *   workflows: libsqlStore.stores?.workflows,
   * }
   * ```
   */
  domains?: CompositeStorageDomains;

  /**
   * When true, automatic initialization is disabled.
   */
  disableInit?: boolean;
}

/**
 * A storage adapter that composes domains from multiple storage backends.
 *
 * CompositeStorage allows you to mix and match storage domains from different
 * adapters. For example, you can use PostgreSQL for memory and workflows,
 * but LibSQL for scores.
 *
 * @example
 * ```typescript
 * import { CompositeStorage } from '@mastra/core/storage';
 * import { PostgresStore } from '@mastra/pg';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const pgStore = new PostgresStore({ id: 'pg', connectionString: '...' });
 * const libsqlStore = new LibSQLStore({ id: 'libsql', url: '...' });
 *
 * // Use PostgreSQL as default, but LibSQL for memory
 * const storage = new CompositeStorage({
 *   id: 'composite',
 *   default: pgStore,
 *   domains: {
 *     memory: libsqlStore.stores?.memory,
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Specify each domain individually (no default)
 * const storage = new CompositeStorage({
 *   id: 'composite',
 *   domains: {
 *     memory: pgStore.stores?.memory,
 *     workflows: pgStore.stores?.workflows,
 *     scores: libsqlStore.stores?.scores,
 *   },
 * });
 * ```
 */
export class CompositeStorage extends MastraStorage {
  #defaultStorage?: MastraStorage;

  stores: StorageDomains;

  constructor(config: CompositeStorageConfig) {
    super({ id: config.id, name: 'CompositeStorage', disableInit: config.disableInit });

    this.#defaultStorage = config.default;

    // Compose stores from default and domain overrides
    const defaultStores = config.default?.stores;
    const domainOverrides = config.domains ?? {};

    // Build the composed stores object
    // Domain overrides take precedence over default storage
    this.stores = {
      memory: domainOverrides.memory ?? defaultStores?.memory,
      workflows: domainOverrides.workflows ?? defaultStores?.workflows,
      scores: domainOverrides.scores ?? defaultStores?.scores,
      observability: domainOverrides.observability ?? defaultStores?.observability,
      agents: domainOverrides.agents ?? defaultStores?.agents,
    } as StorageDomains;
  }

  /**
   * Returns the combined supports from all configured domains.
   * Uses the default storage's supports if available.
   */
  public get supports(): StorageSupports {
    // Use default storage supports if available
    const defaultSupports = this.#defaultStorage?.supports;

    return {
      selectByIncludeResourceScope: defaultSupports?.selectByIncludeResourceScope ?? false,
      resourceWorkingMemory: defaultSupports?.resourceWorkingMemory ?? false,
    };
  }

  /**
   * Initialize all configured domain stores.
   * Each domain is initialized independently.
   */
  async init(): Promise<void> {
    // Use the base class init which initializes all stores
    await super.init();
  }
}
