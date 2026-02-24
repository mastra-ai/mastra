/**
 * Storage factory — creates the appropriate storage backend based on resolved config.
 *
 * If PG is selected but fails to connect, falls back to LibSQL so the TUI
 * can start and the user can fix the connection via /settings.
 */

import type { MastraCompositeStore } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';

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
 * - `pg` backend → PostgresStore, falls back to LibSQL on connection failure
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

  const base = {
    id: 'mastra-code-storage' as const,
    ...(config.schemaName ? { schemaName: config.schemaName } : {}),
    ...(config.disableInit ? { disableInit: config.disableInit } : {}),
    ...(config.skipDefaultIndexes ? { skipDefaultIndexes: config.skipDefaultIndexes } : {}),
  };

  const store = config.connectionString
    ? new PostgresStore({ ...base, connectionString: config.connectionString })
    : new PostgresStore({
        ...base,
        host: config.host!,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
      });

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
