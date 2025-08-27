import type { KVNamespace } from '@cloudflare/workers-types';
import type { StorageThreadType, MastraMessageV2 } from '@mastra/core/memory';
import type { ScoreRowData } from '@mastra/core/scores';
import type {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
  TABLE_RESOURCES,
  TABLE_NAMES,
  EvalRow,
  StorageResourceType,
  TABLE_SCORERS,
  TABLE_AI_SPANS,
  AISpanRecord,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';

/**
 * Configuration for Cloudflare KV using REST API
 */
export interface CloudflareRestConfig {
  /** Cloudflare account ID */
  accountId: string;
  /** Cloudflare API token with KV access */
  apiToken: string;
  /**
   * Prefix for KV namespace names.
   * Recommended for production use to ensure data isolation between different instances.
   * If not provided, no prefix will be used
   */
  namespacePrefix?: string;
}

/**
 * Configuration for Cloudflare KV using Workers Binding API
 */
export interface CloudflareWorkersConfig {
  /** KV namespace bindings from Workers environment */
  bindings: {
    [key in TABLE_NAMES]: KVNamespace;
  };
  /** Optional prefix for keys within namespaces */
  keyPrefix?: string;
}

/**
 * Combined configuration type supporting both REST API and Workers Binding API
 */
export type CloudflareStoreConfig = CloudflareRestConfig | CloudflareWorkersConfig;

/**
 * Interface for KV operations with type support
 */
export interface KVOperation {
  /** Table/namespace to operate on */
  tableName: TABLE_NAMES;
  /** Key to read/write */
  key: string;
  /** Value to write (for put operations) */
  value?: any;
  /** Optional metadata to associate with the value */
  metadata?: any;
}

/**
 * Helper to determine if a config is using Workers bindings
 */
export function isWorkersConfig(config: CloudflareStoreConfig): config is CloudflareWorkersConfig {
  return 'bindings' in config;
}

export type RecordTypes = {
  [TABLE_THREADS]: StorageThreadType;
  [TABLE_MESSAGES]: MastraMessageV2;
  [TABLE_WORKFLOW_SNAPSHOT]: WorkflowRunState;
  [TABLE_EVALS]: EvalRow;
  [TABLE_SCORERS]: ScoreRowData;
  [TABLE_TRACES]: any;
  [TABLE_RESOURCES]: StorageResourceType;
  [TABLE_AI_SPANS]: AISpanRecord;
};

export type ListOptions = {
  limit?: number;
  prefix?: string;
};
