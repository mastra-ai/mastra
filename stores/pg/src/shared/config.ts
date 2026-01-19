import type { ConnectionOptions } from 'node:tls';
import type { CreateIndexOptions } from '@mastra/core/storage';
import type { ClientConfig, Pool, PoolConfig } from 'pg';

/**
 * Base configuration options shared across PostgreSQL configs.
 */
export interface PostgresBaseConfig {
  id: string;
  schemaName?: string;
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
}

/**
 * Connection string configuration.
 */
export interface ConnectionStringConfig extends PostgresBaseConfig {
  connectionString: string;
  ssl?: boolean | ConnectionOptions;
  max?: number;
  idleTimeoutMillis?: number;
}

/**
 * Host-based configuration.
 */
export interface HostConfig extends PostgresBaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | ConnectionOptions;
  max?: number;
  idleTimeoutMillis?: number;
}

/**
 * Pre-configured pg.Pool configuration.
 */
export interface PoolInstanceConfig extends PostgresBaseConfig {
  /**
   * Pre-configured pg.Pool instance.
   * Use this for direct control over the connection pool, or for
   * integration with libraries that expect a pg.Pool.
   *
   * @example
   * ```typescript
   * import { Pool } from 'pg';
   *
   * const pool = new Pool({ connectionString: '...' });
   * const store = new PostgresStore({ id: 'my-store', pool });
   *
   * // Use store.pool for other libraries that need a pg.Pool
   * ```
   */
  pool: Pool;
}

/**
 * PostgreSQL configuration for PostgresStore.
 *
 * Accepts either:
 * - A pre-configured pg.Pool: `{ id, pool, schemaName? }`
 * - Connection string: `{ id, connectionString, ... }`
 * - Host/port config: `{ id, host, port, database, user, password, ... }`
 * - Cloud SQL connector config: `{ id, stream, ... }` (via pg.ClientConfig)
 */
export type PostgresStoreConfig =
  | PoolInstanceConfig
  | ConnectionStringConfig
  | HostConfig
  | (PostgresBaseConfig & ClientConfig);

/**
 * PostgreSQL configuration for PgVector (uses pg with ConnectionOptions)
 */
export type PgVectorConfig = (ConnectionStringConfig | HostConfig | (PostgresBaseConfig & ClientConfig)) & {
  pgPoolOptions?: Omit<PoolConfig, 'connectionString'>;
};

/**
 * Type guard for pre-configured pg.Pool config
 */
export const isPoolConfig = (cfg: PostgresStoreConfig): cfg is PoolInstanceConfig => {
  return 'pool' in cfg;
};

/**
 * Type guard for connection string config
 */
export const isConnectionStringConfig = (cfg: PostgresStoreConfig): cfg is ConnectionStringConfig => {
  return 'connectionString' in cfg && typeof cfg.connectionString === 'string';
};

/**
 * Type guard for host-based config
 */
export const isHostConfig = (cfg: PostgresStoreConfig): cfg is HostConfig => {
  return 'host' in cfg && 'database' in cfg && 'user' in cfg && 'password' in cfg;
};

/**
 * Type guard for Cloud SQL connector config
 */
export const isCloudSqlConfig = (cfg: PostgresStoreConfig): cfg is PostgresBaseConfig & ClientConfig => {
  return 'stream' in cfg || ('password' in cfg && typeof cfg.password === 'function');
};

/**
 * Validates that a Cloud SQL connector stream configuration is properly configured.
 * The stream function must return a stream object with a destroy method.
 *
 * @param stream - The stream property from the config (function or object)
 * @param name - The name of the class/function for error messages
 */
export const validateStreamConfig = (stream: any, name: string): void => {
  if (typeof stream === 'function') {
    // Stream factory: we just check it’s a function; runtime return type not validated
    return;
  } else if (stream !== undefined && stream !== null) {
    // Stream is a direct stream object - check it has destroy method
    if (typeof stream.destroy !== 'function') {
      throw new Error(
        `${name}: stream configuration must return a stream with a destroy method. ` +
          `The stream property should be a function that returns a duplex stream, ` +
          `or a stream object with a destroy() method.`,
      );
    }
  }
};

/**
 * Validate PostgresStore configuration.
 */
export const validateConfig = (name: string, config: PostgresStoreConfig) => {
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    throw new Error(`${name}: id must be provided and cannot be empty.`);
  }

  // Pool config: user provides pre-configured pg.Pool
  if (isPoolConfig(config)) {
    if (!config.pool) {
      throw new Error(`${name}: pool must be provided when using pool config.`);
    }
    return; // Valid pool config
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
    // Validate stream config if present
    if ('stream' in config) {
      validateStreamConfig(config.stream, name);
    }
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
      `${name}: invalid config. Provide either {pool}, {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with \`stream\`).`,
    );
  }
};
