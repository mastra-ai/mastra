import type { ClientConfig } from 'pg';
import type { ISSLConfig } from 'pg-promise/typescript/pg-subset';

import * as pg from 'pg';
import type { ConnectionOptions } from 'tls';

/**
 * Generic PostgreSQL configuration type.
 * @template SSLType - The SSL configuration type (ISSLConfig for pg-promise, ConnectionOptions for pg)
 */
export type PostgresConfig<SSLType = ISSLConfig | ConnectionOptions> = {
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
export type PgVectorConfig = PostgresConfig<ConnectionOptions>;

export type LegacyConfig = {
  connectionString: string;
  schemaName?: string;
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

export const isLegacyConfig = (cfg: any): cfg is LegacyConfig => {
  return 'connectionString' in cfg && 'pgPoolOptions' in cfg;
};
