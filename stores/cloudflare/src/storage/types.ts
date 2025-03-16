import type { StorageThreadType, MessageType } from '@mastra/core/memory';
import {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_TRACES,
} from '@mastra/core/storage';
import type { TABLE_NAMES, EvalRow } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Configuration for Cloudflare KV using REST API
 */
export interface CloudflareRestConfig {
  /** Cloudflare account ID */
  accountId: string;
  /** Cloudflare API token with KV access */
  apiToken: string;
  /** Prefix for KV namespace names */
  namespacePrefix: string;
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
  [TABLE_MESSAGES]: MessageType;
  [TABLE_WORKFLOW_SNAPSHOT]: WorkflowRunState;
  [TABLE_EVALS]: EvalRow;
  [TABLE_TRACES]: any;
};
