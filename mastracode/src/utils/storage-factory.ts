/**
 * Storage factory — creates the appropriate storage backend based on resolved config.
 *
 * LibSQL is always available (direct dependency).
 * PostgreSQL is loaded dynamically via optional `@mastra/pg` dependency.
 *
 * If PG is selected but fails to connect, falls back to LibSQL so the TUI
 * can start and the user can fix the connection via /settings.
 */

import type { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';

import type { StorageConfig, PgStorageConfig } from './project.js';
import { getDatabasePath } from './project.js';

export interface StorageResult {
  storage: MastraCompositeStore;
  /** Non-null when PG was requested but failed — contains a user-facing warning. */
  warning?: string;
}

function createFallbackLibSQL(): MastraCompositeStore {
  return new LibSQLStore({
    id: 'mastra-code-storage',
    url: `file:${getDatabasePath()}`,
  });
}

/**
 * Create a storage instance from the resolved config.
 *
 * - `libsql` backend → LibSQLStore (always available)
 * - `pg` backend → PostgresStore (requires @mastra/pg), falls back to LibSQL on failure
 */
export async function createStorage(config: StorageConfig): Promise<StorageResult> {
  if (config.backend === 'pg') {
    return createPgStorage(config);
  }

  // Default: LibSQL
  return {
    storage: new LibSQLStore({
      id: 'mastra-code-storage',
      url: config.url,
      ...(config.authToken ? { authToken: config.authToken } : {}),
    }),
  };
}

async function createPgStorage(config: PgStorageConfig): Promise<StorageResult> {
  // No connection info → fall back with guidance
  if (!config.connectionString && !config.host) {
    return {
      storage: createFallbackLibSQL(),
      warning:
        'PostgreSQL backend selected but no connection info configured. ' +
        'Using LibSQL fallback. Set a connection string via /settings.',
    };
  }

  let PostgresStore: any;
  try {
    const pg = await import('@mastra/pg');
    PostgresStore = pg.PostgresStore;
  } catch {
    return {
      storage: createFallbackLibSQL(),
      warning:
        'PostgreSQL backend selected but @mastra/pg is not installed. ' +
        'Using LibSQL fallback. Install it with: pnpm add @mastra/pg',
    };
  }

  const storeConfig: Record<string, unknown> = {
    id: 'mastra-code-storage',
  };

  if (config.connectionString) {
    storeConfig.connectionString = config.connectionString;
  } else {
    storeConfig.host = config.host;
    storeConfig.port = config.port;
    storeConfig.database = config.database;
    storeConfig.user = config.user;
    storeConfig.password = config.password;
  }

  if (config.schemaName) storeConfig.schemaName = config.schemaName;
  if (config.disableInit) storeConfig.disableInit = config.disableInit;
  if (config.skipDefaultIndexes) storeConfig.skipDefaultIndexes = config.skipDefaultIndexes;

  const store = new PostgresStore(storeConfig);

  // Test the connection before committing — if it fails, fall back to LibSQL
  // so the user can fix the config via /settings.
  try {
    await store.init();
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const target = config.connectionString ?? `${config.host}:${config.port ?? 5432}`;
    try {
      await store.close();
    } catch {
      // ignore cleanup errors
    }
    return {
      storage: createFallbackLibSQL(),
      warning:
        `Failed to connect to PostgreSQL at ${target}: ${msg}\n` +
        'Using LibSQL fallback. Fix the connection via /settings.',
    };
  }

  return { storage: store };
}
