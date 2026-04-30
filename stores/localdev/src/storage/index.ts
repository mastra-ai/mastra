import type { MastraStorageDomains } from '@mastra/core/storage';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { LibSQLStore } from '@mastra/libsql';

/**
 * Configuration options for {@link LocalDevStore}.
 *
 * All fields are optional — `new LocalDevStore()` is valid and produces a
 * LibSQL-backed store at `file:./mastra.db` with DuckDB at `mastra.duckdb`
 * handling the observability domain.
 */
export interface LocalDevStoreConfig {
  /**
   * Unique identifier for this storage instance.
   * @default 'localdev-storage'
   */
  id?: string;

  /**
   * LibSQL database URL used for the default store.
   * @default 'file:./mastra.db'
   */
  dbPath?: string;

  /**
   * DuckDB database file used for the observability store.
   * @default 'mastra.duckdb'
   */
  duckdbPath?: string;

  /**
   * Override the default store. When provided, replaces the built-in LibSQL
   * default for every domain that isn't covered by `domains`.
   */
  default?: MastraCompositeStore;

  /**
   * Per-domain overrides. Takes precedence over both the LibSQL default and
   * the built-in DuckDB observability store.
   */
  domains?: MastraStorageDomains;
}

/**
 * Local development storage for Mastra.
 *
 * Convenience wrapper around `MastraCompositeStore` that wires a LibSQL
 * default store together with a DuckDB observability store so users can
 * configure storage with a single line:
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core/mastra';
 * import { LocalDevStore } from '@mastra/localdev';
 *
 * export const mastra = new Mastra({
 *   storage: new LocalDevStore(),
 * });
 * ```
 *
 * Override individual pieces when needed:
 *
 * @example
 * ```typescript
 * new LocalDevStore({
 *   dbPath: 'file:./custom.db',
 *   duckdbPath: './traces.duckdb',
 * });
 * ```
 *
 * Not recommended for production: both backends are embedded and hold their
 * data in local files. Swap to a hosted store before deploying to anything
 * with more than a single process.
 */
export class LocalDevStore extends MastraCompositeStore {
  constructor(config: LocalDevStoreConfig = {}) {
    const defaultStore =
      config.default ??
      new LibSQLStore({
        id: 'mastra-storage',
        url: config.dbPath ?? 'file:./mastra.db',
      });

    const duckdb = new DuckDBStore({ path: config.duckdbPath });

    super({
      id: config.id ?? 'localdev-storage',
      name: 'LocalDevStore',
      default: defaultStore,
      domains: {
        observability: duckdb.observability,
        ...config.domains,
      },
    });
  }
}
