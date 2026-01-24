// @mastra/admin-pg - PostgreSQL storage adapter for MastraAdmin

// Main storage class
export { PostgresAdminStorage } from './storage';

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

// Domain classes
export { UsersPG } from './domains/users';
export { TeamsPG } from './domains/teams';
export { ProjectsPG } from './domains/projects';
export { DeploymentsPG } from './domains/deployments';
export { BuildsPG } from './domains/builds';
export { RunningServersPG } from './domains/servers';
export { RoutesPG } from './domains/routes';
export { RbacPG } from './domains/rbac';

// Domain utilities
export type { PgDomainConfig } from './domains/utils';
export { resolvePgConfig } from './domains/utils';
