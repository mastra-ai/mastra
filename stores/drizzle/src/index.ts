export { DrizzleStore } from './storage/index.js';
export type { DrizzleConfig } from './storage/index.js';

// Re-export dialect utilities
export { SchemaBuilder, TableBuilder, createMastraSchema } from './storage/dialects/schema-builder.js';

export { BaseDialect } from './storage/dialects/base.js';
export { DialectFactory } from './storage/dialects/factory.js';

export type {
  DialectConfig,
  SchemaDefinition,
  TableDefinition,
  ColumnDefinition,
  ColumnType,
  SupportedDialect,
  ConnectionConfig,
  QueryResult,
  TransactionClient,
} from './storage/dialects/types.js';

// Re-export types from core for convenience
export type {
  StorageColumn,
  TABLE_NAMES,
  StorageDomains,
  StoragePagination,
  PaginationInfo,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
