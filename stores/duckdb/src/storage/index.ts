import type { StorageDomains } from '@mastra/core/storage';
import { MastraCompositeStore } from '@mastra/core/storage';

import { DuckDBConnection } from './db/index';
import { ObservabilityStorageDuckDB } from './domains/observability/index';

// Re-export lower-level pieces for direct use / composition
export { DuckDBConnection } from './db/index';
export type { DuckDBStorageConfig } from './db/index';
export { ObservabilityStorageDuckDB } from './domains/observability/index';
export type { ObservabilityDuckDBConfig } from './domains/observability/index';

/** Configuration for the top-level DuckDBStore composite. */
export interface DuckDBStoreConfig {
  /** Store identifier. Defaults to 'duckdb'. */
  id?: string;
  /**
   * Path to the DuckDB database file.
   * @default 'mastra.duckdb'
   * Use ':memory:' for an ephemeral in-memory database.
   */
  path?: string;
}

/**
 * DuckDB storage adapter for Mastra.
 *
 * Currently provides observability storage (traces, metrics, logs, scores, feedback).
 * Use via composition with another store for domains DuckDB doesn't yet cover.
 *
 * @example
 * ```typescript
 * // As the observability backend in a composed store
 * const storage = new MastraCompositeStore({
 *   id: 'my-store',
 *   default: new LibSQLStore({ id: 'my-store', url: 'file:./dev.db' }),
 *   domains: {
 *     observability: new DuckDBStore().observability,
 *   },
 * });
 *
 * // Or standalone (only observability domain available)
 * const duckdb = new DuckDBStore();
 * const obs = await duckdb.getStore('observability');
 * ```
 */
export class DuckDBStore extends MastraCompositeStore {
  readonly db: DuckDBConnection;

  stores: StorageDomains;

  constructor(config: DuckDBStoreConfig = {}) {
    const id = config.id ?? 'duckdb';
    super({ id, name: 'DuckDBStore' });

    this.db = new DuckDBConnection({ path: config.path });

    const observability = new ObservabilityStorageDuckDB({ db: this.db });

    this.stores = {
      observability,
    };
  }

  /** Convenience accessor for the observability domain. */
  get observability(): ObservabilityStorageDuckDB {
    return this.stores.observability as ObservabilityStorageDuckDB;
  }
}
