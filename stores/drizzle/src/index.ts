export { DrizzleStore } from './storage/index.js';
export type { DrizzleConfig } from './storage/index.js';

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
