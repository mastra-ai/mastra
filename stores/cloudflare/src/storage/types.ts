import type { KVNamespace } from '@cloudflare/workers-types';
import type { ScoreRowData } from '@mastra/core/evals';
import type { StorageThreadType, MastraDBMessage } from '@mastra/core/memory';
import type {
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_TRACES,
  TABLE_RESOURCES,
  TABLE_NAMES,
  StorageResourceType,
  TABLE_SCORERS,
  TABLE_SPANS,
  TABLE_AGENTS,
  TABLE_AGENT_VERSIONS,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  TABLE_PROMPT_BLOCKS,
  TABLE_PROMPT_BLOCK_VERSIONS,
  TABLE_SCORER_DEFINITIONS,
  TABLE_SCORER_DEFINITION_VERSIONS,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  TABLE_MCP_SERVERS,
  TABLE_MCP_SERVER_VERSIONS,
  TABLE_WORKSPACES,
  TABLE_WORKSPACE_VERSIONS,
  TABLE_SKILLS,
  TABLE_SKILL_VERSIONS,
  TABLE_SKILL_BLOBS,
  SpanRecord,
  StorageAgentType,
  StoragePromptBlockType,
  StorageScorerDefinitionType,
  StorageMCPClientType,
  StorageMCPServerType,
  StorageWorkspaceType,
  StorageSkillType,
  StorageBlobEntry,
} from '@mastra/core/storage';
import type { AgentVersion } from '@mastra/core/storage/domains/agents';
import type { MCPClientVersion } from '@mastra/core/storage/domains/mcp-clients';
import type { MCPServerVersion } from '@mastra/core/storage/domains/mcp-servers';
import type { PromptBlockVersion } from '@mastra/core/storage/domains/prompt-blocks';
import type { ScorerDefinitionVersion } from '@mastra/core/storage/domains/scorer-definitions';
import type { SkillVersion } from '@mastra/core/storage/domains/skills';
import type { WorkspaceVersion } from '@mastra/core/storage/domains/workspaces';
import type { WorkflowRunState } from '@mastra/core/workflows';
import type Cloudflare from 'cloudflare';

/**
 * Base configuration options shared across Cloudflare configurations
 */
export interface CloudflareBaseConfig {
  /** Storage instance ID */
  id: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new CloudflareStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new CloudflareStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
}

/**
 * Configuration for Cloudflare KV using REST API
 */
export interface CloudflareRestConfig extends CloudflareBaseConfig {
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
export interface CloudflareWorkersConfig extends CloudflareBaseConfig {
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
  [TABLE_MESSAGES]: MastraDBMessage;
  [TABLE_WORKFLOW_SNAPSHOT]: WorkflowRunState;
  [TABLE_SCORERS]: ScoreRowData;
  [TABLE_TRACES]: any;
  [TABLE_RESOURCES]: StorageResourceType;
  [TABLE_SPANS]: SpanRecord;
  [TABLE_AGENTS]: StorageAgentType;
  [TABLE_AGENT_VERSIONS]: AgentVersion;
  [TABLE_DATASETS]: Record<string, any>;
  [TABLE_DATASET_ITEMS]: Record<string, any>;
  [TABLE_DATASET_VERSIONS]: Record<string, any>;
  [TABLE_EXPERIMENTS]: Record<string, any>;
  [TABLE_EXPERIMENT_RESULTS]: Record<string, any>;
  [TABLE_PROMPT_BLOCKS]: StoragePromptBlockType;
  [TABLE_PROMPT_BLOCK_VERSIONS]: PromptBlockVersion;
  [TABLE_SCORER_DEFINITIONS]: StorageScorerDefinitionType;
  [TABLE_SCORER_DEFINITION_VERSIONS]: ScorerDefinitionVersion;
  [TABLE_MCP_CLIENTS]: StorageMCPClientType;
  [TABLE_MCP_CLIENT_VERSIONS]: MCPClientVersion;
  [TABLE_MCP_SERVERS]: StorageMCPServerType;
  [TABLE_MCP_SERVER_VERSIONS]: MCPServerVersion;
  [TABLE_WORKSPACES]: StorageWorkspaceType;
  [TABLE_WORKSPACE_VERSIONS]: WorkspaceVersion;
  [TABLE_SKILLS]: StorageSkillType;
  [TABLE_SKILL_VERSIONS]: SkillVersion;
  [TABLE_SKILL_BLOBS]: StorageBlobEntry;
};

export type ListOptions = {
  limit?: number;
  prefix?: string;
};

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing Cloudflare client (REST API) or bindings (Workers API)
 * 2. Config to create a new client internally
 */
export type CloudflareDomainConfig =
  | CloudflareDomainClientConfig
  | CloudflareDomainBindingsConfig
  | CloudflareDomainRestConfig;

/**
 * Pass an existing Cloudflare SDK client (REST API)
 */
export interface CloudflareDomainClientConfig {
  client: Cloudflare;
  accountId: string;
  namespacePrefix?: string;
}

/**
 * Pass existing KV bindings (Workers Binding API)
 */
export interface CloudflareDomainBindingsConfig {
  bindings: {
    [key in TABLE_NAMES]: KVNamespace;
  };
  keyPrefix?: string;
}

/**
 * Pass config to create a new Cloudflare client internally (REST API)
 */
export interface CloudflareDomainRestConfig {
  accountId: string;
  apiToken: string;
  namespacePrefix?: string;
}
