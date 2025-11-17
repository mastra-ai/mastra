import type { ConnectionOptions } from 'tls';
import type { ClientConfig } from 'pg';
import type * as pg from 'pg';
import type { ISSLConfig } from 'pg-promise/typescript/pg-subset';

/**
 * Generic PostgreSQL configuration type.
 * @template SSLType - The SSL configuration type (ISSLConfig for pg-promise, ConnectionOptions for pg)
 */
export type PostgresConfig<SSLType = ISSLConfig | ConnectionOptions> = {
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
 * PostgreSQL configuration for PostgresStore (uses pg-promise with ISSLConfig)
 */
export type PostgresStoreConfig = PostgresConfig<ISSLConfig>;

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

export const validateConfig = (name: string, config: PostgresConfig<ISSLConfig | ConnectionOptions>) => {
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
