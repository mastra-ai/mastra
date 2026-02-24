/**
 * Vector factory — creates the appropriate vector backend based on storage config.
 *
 * Currently vector is optional in mastracode. This factory exists so that when
 * vector features are needed, the backend aligns with the storage backend.
 *
 * - `libsql` backend → LibSQLVector (from @mastra/libsql)
 * - `pg` backend → PgVector (from @mastra/pg, requires pgvector extension)
 */

import type { MastraVector } from '@mastra/core/vector';

import type { StorageConfig } from './project.js';

/**
 * Create a vector store instance aligned with the storage backend.
 * Returns null if vector is not enabled.
 *
 * @param config - The resolved storage config (determines which vector backend to use)
 * @param vectorEnabled - Whether vector features are enabled
 */
export async function createVector(
  config: StorageConfig,
  vectorEnabled: boolean,
): Promise<MastraVector | null> {
  if (!vectorEnabled) return null;

  if (config.backend === 'pg') {
    return createPgVector(config);
  }

  return createLibSQLVector(config);
}

async function createLibSQLVector(config: StorageConfig & { backend: 'libsql' }): Promise<MastraVector> {
  const { LibSQLVector } = await import('@mastra/libsql');
  return new LibSQLVector({
    id: 'mastra-code-vector',
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  });
}

async function createPgVector(config: StorageConfig & { backend: 'pg' }): Promise<MastraVector> {
  let PgVector: any;
  try {
    const pg = await import('@mastra/pg');
    PgVector = pg.PgVector;
  } catch {
    throw new Error(
      'PostgreSQL vector store selected but @mastra/pg is not installed. ' +
        'Install it with: pnpm add @mastra/pg',
    );
  }

  const vectorConfig: Record<string, unknown> = {
    id: 'mastra-code-vector',
  };

  if (config.connectionString) {
    vectorConfig.connectionString = config.connectionString;
  } else {
    vectorConfig.host = config.host;
    vectorConfig.port = config.port;
    vectorConfig.database = config.database;
    vectorConfig.user = config.user;
    vectorConfig.password = config.password;
  }

  if (config.schemaName) vectorConfig.schemaName = config.schemaName;

  return new PgVector(vectorConfig);
}
