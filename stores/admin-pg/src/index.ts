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
