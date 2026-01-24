import type { Pool } from 'pg';

/**
 * Base configuration shared by all PostgresAdminStorage configs
 */
export interface PostgresAdminBaseConfig {
  /** Unique identifier for this storage instance */
  id?: string;
  /** PostgreSQL schema name (default: 'mastra_admin') */
  schemaName?: string;
  /** Skip automatic table initialization */
  disableInit?: boolean;
  /** Skip creation of default indexes */
  skipDefaultIndexes?: boolean;
}

/**
 * Config using an existing pg.Pool instance
 */
export interface PoolInstanceConfig extends PostgresAdminBaseConfig {
  pool: Pool;
}

/**
 * Config using a connection string
 */
export interface ConnectionStringConfig extends PostgresAdminBaseConfig {
  connectionString: string;
}

/**
 * Config using explicit host/port/credentials
 */
export interface HostConfig extends PostgresAdminBaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
}

/**
 * Union of all valid config types
 */
export type PostgresAdminStorageConfig = PoolInstanceConfig | ConnectionStringConfig | HostConfig;

/**
 * Type guards for config discrimination
 */
export function isPoolConfig(config: PostgresAdminStorageConfig): config is PoolInstanceConfig {
  return 'pool' in config && config.pool !== undefined;
}

export function isConnectionStringConfig(config: PostgresAdminStorageConfig): config is ConnectionStringConfig {
  return 'connectionString' in config && typeof config.connectionString === 'string';
}

export function isHostConfig(config: PostgresAdminStorageConfig): config is HostConfig {
  return 'host' in config && 'port' in config && 'database' in config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: PostgresAdminStorageConfig): void {
  if (isPoolConfig(config)) {
    if (!config.pool) {
      throw new Error('PostgresAdminStorage: pool must be a valid pg.Pool instance');
    }
    return;
  }

  if (isConnectionStringConfig(config)) {
    if (!config.connectionString || config.connectionString.trim() === '') {
      throw new Error('PostgresAdminStorage: connectionString must be a non-empty string');
    }
    return;
  }

  if (isHostConfig(config)) {
    if (!config.host || !config.database || !config.user) {
      throw new Error('PostgresAdminStorage: host, database, and user are required');
    }
    if (typeof config.port !== 'number' || config.port <= 0) {
      throw new Error('PostgresAdminStorage: port must be a positive number');
    }
    return;
  }

  throw new Error('PostgresAdminStorage: invalid configuration provided');
}

/**
 * Parse SQL identifier to prevent SQL injection
 */
export function parseSqlIdentifier(value: string, label: string): string {
  // Only allow alphanumeric and underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(
      `PostgresAdminStorage: ${label} contains invalid characters. ` +
        'Only letters, numbers, and underscores are allowed.',
    );
  }
  return value;
}
