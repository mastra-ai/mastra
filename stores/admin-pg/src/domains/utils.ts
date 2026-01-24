import type { Pool } from 'pg';
import type { DbClient } from '../client';
import { PoolAdapter } from '../client';

export interface PgDomainConfig {
  client?: DbClient;
  pool?: Pool;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
}

export function resolvePgConfig(config: PgDomainConfig): {
  client: DbClient;
  schemaName?: string;
  skipDefaultIndexes?: boolean;
} {
  if (config.client) {
    return {
      client: config.client,
      schemaName: config.schemaName,
      skipDefaultIndexes: config.skipDefaultIndexes,
    };
  }

  if (config.pool) {
    return {
      client: new PoolAdapter(config.pool),
      schemaName: config.schemaName,
      skipDefaultIndexes: config.skipDefaultIndexes,
    };
  }

  throw new Error('Either client or pool must be provided');
}
