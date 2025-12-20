import type { ConnectionOptions } from 'node:tls';
import type { ClientConfig } from 'pg';
import type * as pg from 'pg';
import type pgPromise from 'pg-promise';
import type { ISSLConfig } from 'pg-promise/typescript/pg-subset';
import type { CreateIndexOptions } from '@mastra/core/storage';

/**
 * Generic PostgreSQL configuration type.
 * @template SSLType - The SSL configuration type (ISSLConfig for pg-promise, ConnectionOptions for pg)
 */
export type PostgresConfig<SSLType = ISSLConfig | ConnectionOptions> = {
  id: string;
  schemaName?: string;
  max?: number;
  idleTimeoutMillis?: number;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new PostgresStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new PostgresStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
  /**
   * When true, default indexes will not be created during initialization.
   * This is useful when:
   * 1. You want to manage indexes separately or use custom indexes only
   * 2. Default indexes don't match your query patterns
   * 3. You want to reduce initialization time in development
   *
   * @default false
   */
  skipDefaultIndexes?: boolean;
  /**
   * Custom indexes to create during initialization.
   * These indexes are created in addition to default indexes (unless skipDefaultIndexes is true).
   *
   * Each index must specify which table it belongs to. The store will route each index
   * to the appropriate domain based on the table name.
   *
   * @example
   * ```typescript
   * const store = new PostgresStore({
   *   connectionString: '...',
   *   indexes: [
   *     { name: 'my_threads_type_idx', table: 'mastra_threads', columns: ['metadata->>\'type\''] },
   *     { name: 'my_messages_status_idx', table: 'mastra_messages', columns: ['metadata->>\'status\''] },
   *   ],
   * });
   * ```
   */
  indexes?: CreateIndexOptions[];
} & (
  | {
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
      ssl?: boolean | SSLType;
    }
  | {
      connectionString: string;
      ssl?: boolean | SSLType;
    }
  // Support Cloud SQL Connector & pg ClientConfig
  | ClientConfig
);

/**
 * PostgreSQL configuration for PostgresStore (uses pg-promise with ISSLConfig)
 *
 * Accepts either:
 * - A pre-configured pg-promise client: `{ id, client, schemaName? }`
 * - Connection string: `{ id, connectionString, ... }`
 * - Host/port config: `{ id, host, port, database, user, password, ... }`
 * - Cloud SQL connector config: `{ id, stream, ... }`
 */
export type PostgresStoreConfig =
  | PostgresConfig<ISSLConfig>
  | {
      id: string;
      /**
       * Pre-configured pg-promise database client.
       * Use this when you need to configure the client before initialization,
       * e.g., to add pool listeners or set connection-level settings.
       *
       * @example
       * ```typescript
       * import pgPromise from 'pg-promise';
       *
       * const pgp = pgPromise();
       * const client = pgp({ connectionString: '...' });
       *
       * // Custom setup before using
       * client.$pool.on('connect', async (poolClient) => {
       *   await poolClient.query('SET ROLE my_role;');
       * });
       *
       * const store = new PostgresStore({ id: 'my-store', client });
       * ```
       */
      client: pgPromise.IDatabase<{}>;
      schemaName?: string;
      disableInit?: boolean;
      skipDefaultIndexes?: boolean;
      indexes?: CreateIndexOptions[];
    };

/**
 * PostgreSQL configuration for PgVector (uses pg with ConnectionOptions)
 */
export type PgVectorConfig = PostgresConfig<ConnectionOptions> & {
  pgPoolOptions?: Omit<pg.PoolConfig, 'connectionString'>;
};

export const isConnectionStringConfig = <SSLType>(
  cfg: PostgresConfig<SSLType>,
): cfg is PostgresConfig<SSLType> & { connectionString: string; ssl?: boolean | SSLType } => {
  return 'connectionString' in cfg;
};

export const isHostConfig = <SSLType>(
  cfg: PostgresConfig<SSLType>,
): cfg is PostgresConfig<SSLType> & {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | SSLType;
} => {
  return 'host' in cfg && 'database' in cfg && 'user' in cfg && 'password' in cfg;
};

export const isCloudSqlConfig = <SSLType>(
  cfg: PostgresConfig<SSLType>,
): cfg is PostgresConfig<SSLType> & ClientConfig => {
  return 'stream' in cfg || ('password' in cfg && typeof cfg.password === 'function');
};

/**
 * Type guard for pre-configured client config (PostgresStore only)
 */
export const isClientConfig = (
  cfg: PostgresStoreConfig,
): cfg is {
  id: string;
  client: pgPromise.IDatabase<{}>;
  schemaName?: string;
  disableInit?: boolean;
  skipDefaultIndexes?: boolean;
  indexes?: CreateIndexOptions[];
} => {
  return 'client' in cfg;
};

export const validateConfig = (name: string, config: PostgresStoreConfig) => {
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    throw new Error(`${name}: id must be provided and cannot be empty.`);
  }

  // Client config: user provides pre-configured pg-promise client
  if (isClientConfig(config)) {
    if (!config.client) {
      throw new Error(`${name}: client must be provided when using client config.`);
    }
    return; // Valid client config
  }

  if (isConnectionStringConfig(config)) {
    if (
      !config.connectionString ||
      typeof config.connectionString !== 'string' ||
      config.connectionString.trim() === ''
    ) {
      throw new Error(
        `${name}: connectionString must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.`,
      );
    }
  } else if (isCloudSqlConfig(config)) {
    // valid connector config; no-op
  } else if (isHostConfig(config)) {
    const required = ['host', 'database', 'user', 'password'] as const;
    for (const key of required) {
      if (!config[key] || typeof config[key] !== 'string' || config[key].trim() === '') {
        throw new Error(
          `${name}: ${key} must be provided and cannot be empty. Passing an empty string may cause fallback to local Postgres defaults.`,
        );
      }
    }
  } else {
    throw new Error(
      `${name}: invalid config. Provide either {client}, {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with \`stream\`).`,
    );
  }
};
