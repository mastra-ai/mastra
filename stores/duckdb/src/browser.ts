/**
 * Entry resolved under the `browser` export condition.
 *
 * `@mastra/duckdb` wraps native `.node` bindings and can only run in Node.js.
 * Client-side bundlers (e.g. Vite's dependency optimizer, which TanStack Start
 * runs over server-only route imports) resolve this module instead of the real
 * entry so they never trace into the native binaries. Every export throws when
 * used so accidental client usage fails with a clear message.
 */

function serverOnly(name: string) {
  return class {
    constructor() {
      throw new Error(`${name} from @mastra/duckdb is only available in Node.js server environments.`);
    }
  };
}

export const DuckDBVector = serverOnly('DuckDBVector');
export const DuckDBConnection = serverOnly('DuckDBConnection');
export const DuckDBStore = serverOnly('DuckDBStore');
export const ObservabilityStorageDuckDB = serverOnly('ObservabilityStorageDuckDB');

export type { DuckDBVectorConfig, DuckDBVectorFilter } from './vector/types';
export type { DuckDBStorageConfig, DuckDBStoreConfig, ObservabilityDuckDBConfig } from './storage/index';
