import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import type { CreateIndexOptions } from '@mastra/core/storage';
import type { Pool } from 'pg';

/**
 * Default connection pool settings optimized for Aurora DSQL.
 *
 * Aurora DSQL has a 60-minute maximum connection duration limit,
 * so maxLifetimeSeconds is set to 55 minutes to ensure connections
 * are rotated before hitting that limit.
 */
export const DSQL_POOL_DEFAULTS = {
  /** Maximum connections in the pool */
  max: 10,
  /** Minimum connections in the pool */
  min: 0,
  /** Close idle connections after 10 minutes */
  idleTimeoutMillis: 600000,
  /** Force connection rotation before DSQL's 60-minute limit */
  maxLifetimeSeconds: 3300,
  /** Connection acquisition timeout */
  connectionTimeoutMillis: 5000,
  /** Allow process to exit when idle */
  allowExitOnIdle: true,
} as const;

/**
 * Base configuration options shared across Aurora DSQL configs.
 */
export interface DSQLBaseConfig {
  /** Unique identifier for this store instance */
  id: string;

  /** Schema name (default: "public") */
  schemaName?: string;

  /**
   * If true, the store will not be initialized automatically when used with Mastra.
   * Use this when you want to manage initialization timing yourself.
   */
  disableInit?: boolean;

  /** Skip creation of default indexes (default: false) */
  skipDefaultIndexes?: boolean;

  /** Custom index definitions to create */
  indexes?: CreateIndexOptions[];
}

/**
 * Aurora DSQL host-based configuration.
 *
 * Aurora DSQL uses IAM authentication, so password is not required.
 * The connector automatically generates IAM tokens for authentication.
 */
export interface HostConfig extends DSQLBaseConfig {
  /** DSQL cluster endpoint (e.g., "abc123.dsql.us-east-1.on.aws") */
  host: string;

  /** Database user (default: "admin") */
  user?: string;

  /** Database name (default: "postgres", Aurora DSQL supports only one database per cluster) */
  database?: string;

  /** AWS region (auto-detected from host if not provided) */
  region?: string;

  /** Custom AWS credentials provider (optional, uses default credential chain if not provided) */
  customCredentialsProvider?: AwsCredentialIdentityProvider;

  /** Maximum number of connections in the pool (default: 10) */
  max?: number;

  /** Minimum number of connections in the pool (default: 0) */
  min?: number;

  /** Close idle connections after this many milliseconds (default: 600000 = 10 minutes) */
  idleTimeoutMillis?: number;

  /** Maximum connection lifetime in seconds (default: 3300 = 55 minutes, must be < 60 minutes due to DSQL limit) */
  maxLifetimeSeconds?: number;

  /** Connection timeout in milliseconds (default: 5000) */
  connectionTimeoutMillis?: number;

  /** Allow the process to exit when all connections are idle (default: true) */
  allowExitOnIdle?: boolean;
}

/**
 * Pre-configured pg.Pool configuration for Aurora DSQL.
 */
export interface PoolInstanceConfig extends DSQLBaseConfig {
  /**
   * Pre-configured pg.Pool instance.
   * Use this for direct control over the connection pool, or for
   * integration with libraries that expect a pg.Pool.
   *
   * @example
   * ```typescript
   * import { Pool } from 'pg';
   * import { AuroraDSQLClient } from '@aws/aurora-dsql-node-postgres-connector';
   *
   * const pool = new Pool({
   *   host: 'abc123.dsql.us-east-1.on.aws',
   *   Client: AuroraDSQLClient,
   *   region: 'us-east-1',
   * });
   * const store = new DSQLStore({ id: 'my-store', pool });
   *
   * // Use store.pool for other libraries that need a pg.Pool
   * ```
   */
  pool: Pool;
}

/**
 * Aurora DSQL configuration type.
 *
 * Accepts either:
 * - A pre-configured pg.Pool: `{ id, pool, schemaName? }`
 * - Host-based config: `{ id, host, ... }`
 */
export type DSQLStoreConfig = PoolInstanceConfig | HostConfig | DSQLBaseConfig;

/**
 * Type guard for pre-configured pg.Pool config
 */
export const isPoolConfig = (cfg: DSQLStoreConfig): cfg is PoolInstanceConfig => {
  return 'pool' in cfg;
};

/**
 * Type guard for host-based config
 */
export const isHostConfig = (cfg: DSQLStoreConfig): cfg is HostConfig => {
  return 'host' in cfg;
};

/**
 * Validates the DSQLStoreConfig and throws an error if invalid.
 */
export const validateConfig = (config: DSQLStoreConfig): void => {
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    throw new Error('DSQLStore: id must be provided and cannot be empty.');
  }

  // Pool config: user provides pre-configured pg.Pool
  if (isPoolConfig(config)) {
    if (!config.pool) {
      throw new Error('DSQLStore: pool must be provided when using pool config.');
    }
    return; // Valid pool config
  }

  // Host-based config (host is required if not pool config)
  if (!isHostConfig(config)) {
    throw new Error('DSQLStore: host must be provided and cannot be empty.');
  }

  // Validate host is not empty
  if (!config.host || config.host.trim() === '') {
    throw new Error('DSQLStore: host must be provided and cannot be empty.');
  }

  // Validate maxLifetimeSeconds is less than 60 minutes (Aurora DSQL hard limit)
  if (config.maxLifetimeSeconds !== undefined && config.maxLifetimeSeconds >= 3600) {
    throw new Error(
      'DSQLStore: maxLifetimeSeconds must be less than 3600 (60 minutes) due to Aurora DSQL connection duration limit.',
    );
  }
};

/**
 * Extracts AWS region from DSQL host endpoint.
 * DSQL endpoints follow the pattern: <cluster-id>.dsql.<region>.on.aws
 */
export const extractRegionFromHost = (host: string): string | undefined => {
  const match = host.match(/\.dsql\.([a-z0-9-]+)\.on\.aws$/);
  return match?.[1];
};

/**
 * Returns the effective region, either from config or extracted from host.
 * Only applicable for host-based config (not pre-configured pool).
 */
export const getEffectiveRegion = (config: HostConfig): string => {
  if (config.region) {
    return config.region;
  }

  const extractedRegion = extractRegionFromHost(config.host);
  if (extractedRegion) {
    return extractedRegion;
  }

  throw new Error(
    'DSQLStore: region could not be determined. Provide region in config or use a standard DSQL endpoint.',
  );
};
