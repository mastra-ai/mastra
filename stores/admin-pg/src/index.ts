// @mastra/admin-pg - PostgreSQL storage adapter for MastraAdmin

// Configuration types
export type {
  PostgresAdminStorageConfig,
  PostgresAdminBaseConfig,
  PoolInstanceConfig,
  ConnectionStringConfig,
  HostConfig,
} from './shared/config';

export { isPoolConfig, isConnectionStringConfig, isHostConfig, validateConfig, parseSqlIdentifier } from './shared/config';

// Client types
export type { DbClient, TxClient, QueryValues } from './client';
export { PoolAdapter } from './client';

// Migration schemas (for external tooling)
export { TABLES, TABLE_SCHEMAS, DEFAULT_INDEXES, type TableName, type IndexDefinition } from './migrations/001_initial';

// Database utilities
export { AdminPgDB } from './db';
