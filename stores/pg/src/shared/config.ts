import type { ConnectionOptions } from 'node:tls';
import type { ClientConfig } from 'pg';
import type * as pg from 'pg';

/**
 * Generic PostgreSQL configuration type.
 * @template SSLType - The SSL configuration type (ConnectionOptions for pg)
 */
export type PostgresConfig<SSLType = ConnectionOptions> = {
  id: string;
  schemaName?: string;
  max?: number;
  idleTimeoutMillis?: number;
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
 * PostgreSQL configuration for PostgresStore (uses pg directly)
 * Users can provide their own pg.Pool via the `pool` option.
 */
export type PostgresStoreConfig = PostgresConfig<ConnectionOptions> & {
  /**
   * Bring your own pg.Pool.
   * When provided, the store will use this pool instead of creating its own.
   * The pool will NOT be closed when the store is closed - you are responsible for managing its lifecycle.
   * This is the recommended option for serverless environments (e.g., Cloudflare, Neon serverless).
   */
  pool?: pg.Pool;
};

/**
 * Simplified config for BYOC with pg.Pool only (no connection details needed)
 */
export type PostgresStorePoolConfig = {
  /** Unique identifier for this store instance */
  id: string;
  /** Custom PostgreSQL schema name (default: 'public') */
  schemaName?: string;
  /**
   * Bring your own pg.Pool.
   * When provided, the store will use this pool instead of creating its own.
   * The pool will NOT be closed when the store is closed - you are responsible for managing its lifecycle.
   * This is the recommended option for serverless environments (e.g., Cloudflare, Neon serverless).
   */
  pool: pg.Pool;
};

/**
 * PostgreSQL configuration for PgVector (uses pg with ConnectionOptions)
 * Users can provide their own pg.Pool via the `pool` option.
 */
export type PgVectorConfig = PostgresConfig<ConnectionOptions> & {
  pgPoolOptions?: Omit<pg.PoolConfig, 'connectionString'>;
  /**
   * Bring your own pg.Pool.
   * When provided, the vector store will use this pool instead of creating its own.
   * The pool will NOT be closed when disconnect() is called - you are responsible for managing its lifecycle.
   */
  pool?: pg.Pool;
};

/**
 * Simplified config for BYOC with pg.Pool only (no connection details needed)
 */
export type PgVectorPoolConfig = {
  /** Unique identifier for this vector store instance */
  id: string;
  /** Custom PostgreSQL schema name (default: 'public') */
  schemaName?: string;
  /**
   * Bring your own pg.Pool.
   * When provided, the vector store will use this pool instead of creating its own.
   * The pool will NOT be closed when disconnect() is called - you are responsible for managing its lifecycle.
   */
  pool: pg.Pool;
};

/**
 * Check if config has a user-provided pg.Pool (for PostgresStore)
 */
export const hasUserProvidedStorePool = (
  cfg: PostgresStoreConfig | PostgresStorePoolConfig,
): cfg is PostgresStorePoolConfig => {
  return 'pool' in cfg && cfg.pool !== undefined;
};

/**
 * Check if config has a user-provided pg.Pool (for PgVector)
 */
export const hasUserProvidedPool = (cfg: PgVectorConfig | PgVectorPoolConfig): cfg is PgVectorPoolConfig => {
  return 'pool' in cfg && cfg.pool !== undefined;
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

export const validateConfig = (name: string, config: PostgresConfig<ConnectionOptions>) => {
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    throw new Error(`${name}: id must be provided and cannot be empty.`);
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
      `${name}: invalid config. Provide either {connectionString}, {host,port,database,user,password}, or a pg ClientConfig (e.g., Cloud SQL connector with \`stream\`).`,
    );
  }
};

/**
 * Validate config for PgVector, including BYOC pool option
 */
export const validatePgVectorConfig = (config: PgVectorConfig | PgVectorPoolConfig) => {
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    throw new Error(`PgVector: id must be provided and cannot be empty.`);
  }

  if (hasUserProvidedPool(config)) {
    // User provided their own pool, no further validation needed
    return;
  }

  // Validate as regular config
  validateConfig('PgVector', config as PostgresConfig<ConnectionOptions>);
};

/**
 * Validate config for PostgresStore, including BYOC pool option
 */
export const validatePostgresStoreConfig = (config: PostgresStoreConfig | PostgresStorePoolConfig) => {
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    throw new Error(`PostgresStore: id must be provided and cannot be empty.`);
  }

  if (hasUserProvidedStorePool(config)) {
    // User provided their own pool, no further validation needed
    return;
  }

  // Validate as regular config
  validateConfig('PostgresStore', config as PostgresConfig<ConnectionOptions>);
};
