import type { z } from 'zod';
import type { SerializedError } from '../error';
import type { MastraDBMessage, StorageThreadType } from '../memory/types';
import { getZodTypeName } from '../utils/zod-utils';
import type { StepResult, WorkflowRunState, WorkflowRunStatus } from '../workflows';

export type StoragePagination = {
  page: number;
  perPage: number | false;
};

export type StorageColumnType = 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer' | 'float' | 'bigint' | 'boolean';

export interface StorageColumn {
  type: StorageColumnType;
  primaryKey?: boolean;
  nullable?: boolean;
  references?: {
    table: string;
    column: string;
  };
}
export interface WorkflowRuns {
  runs: WorkflowRun[];
  total: number;
}

export interface StorageWorkflowRun {
  workflow_name: string;
  run_id: string;
  resourceId?: string;
  snapshot: WorkflowRunState | string;
  createdAt: Date;
  updatedAt: Date;
}
export interface WorkflowRun {
  workflowName: string;
  runId: string;
  snapshot: WorkflowRunState | string;
  createdAt: Date;
  updatedAt: Date;
  resourceId?: string;
}

export type PaginationInfo = {
  total: number;
  page: number;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * When `false`, all matching records are returned in a single response.
   */
  perPage: number | false;
  hasMore: boolean;
};

export type MastraMessageFormat = 'v1' | 'v2';

export type StorageListMessagesInput = {
  threadId: string | string[];
  resourceId?: string;
  include?: {
    id: string;
    threadId?: string;
    withPreviousMessages?: number;
    withNextMessages?: number;
  }[];
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 40 if not specified.
   */
  perPage?: number | false;
  /**
   * Zero-indexed page number for pagination.
   * Defaults to 0 if not specified.
   */
  page?: number;
  filter?: {
    dateRange?: {
      start?: Date;
      end?: Date;
      /**
       * When true, excludes the start date from results (uses > instead of >=).
       * Useful for cursor-based pagination to avoid duplicates.
       * @default false
       */
      startExclusive?: boolean;
      /**
       * When true, excludes the end date from results (uses < instead of <=).
       * Useful for cursor-based pagination to avoid duplicates.
       * @default false
       */
      endExclusive?: boolean;
    };
  };
  orderBy?: StorageOrderBy<'createdAt'>;
};

export type StorageListMessagesOutput = PaginationInfo & {
  messages: MastraDBMessage[];
};

export type StorageListWorkflowRunsInput = {
  workflowName?: string;
  fromDate?: Date;
  toDate?: Date;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * When undefined, returns all workflow runs without pagination.
   * When both perPage and page are provided, pagination is applied.
   */
  perPage?: number | false;
  /**
   * Zero-indexed page number for pagination.
   * When both perPage and page are provided, pagination is applied.
   * When either is undefined, all results are returned.
   */
  page?: number;
  resourceId?: string;
  status?: WorkflowRunStatus;
};

export type StorageListThreadsByResourceIdInput = {
  resourceId: string;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 100 if not specified.
   */
  perPage?: number | false;
  /**
   * Zero-indexed page number for pagination.
   * Defaults to 0 if not specified.
   */
  page?: number;
  orderBy?: StorageOrderBy;
};

export type StorageListThreadsByResourceIdOutput = PaginationInfo & {
  threads: StorageThreadType[];
};

/**
 * Metadata stored on cloned threads to track their origin
 */
export type ThreadCloneMetadata = {
  /** ID of the thread this was cloned from */
  sourceThreadId: string;
  /** Timestamp when the clone was created */
  clonedAt: Date;
  /** ID of the last message included in the clone (if messages were copied) */
  lastMessageId?: string;
};

/**
 * Input options for cloning a thread
 */
export type StorageCloneThreadInput = {
  /** ID of the thread to clone */
  sourceThreadId: string;
  /** ID for the new cloned thread (if not provided, a random UUID will be generated) */
  newThreadId?: string;
  /** Resource ID for the new thread (defaults to source thread's resourceId) */
  resourceId?: string;
  /** Title for the new cloned thread */
  title?: string;
  /** Additional metadata to merge with clone metadata */
  metadata?: Record<string, unknown>;
  /** Options for filtering which messages to include */
  options?: {
    /** Maximum number of messages to copy (from most recent) */
    messageLimit?: number;
    /** Filter messages by date range or specific IDs */
    messageFilter?: {
      /** Only include messages created on or after this date */
      startDate?: Date;
      /** Only include messages created on or before this date */
      endDate?: Date;
      /** Only include messages with these specific IDs */
      messageIds?: string[];
    };
  };
};

/**
 * Output from cloning a thread
 */
export type StorageCloneThreadOutput = {
  /** The newly created cloned thread */
  thread: StorageThreadType;
  /** The messages that were copied to the new thread */
  clonedMessages: MastraDBMessage[];
};

export type StorageResourceType = {
  id: string;
  workingMemory?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type StorageMessageType = {
  id: string;
  thread_id: string;
  content: string;
  role: string;
  type: string;
  createdAt: Date;
  resourceId: string | null;
};

export interface StorageOrderBy<TField extends ThreadOrderBy = ThreadOrderBy> {
  field?: TField;
  direction?: ThreadSortDirection;
}

export interface ThreadSortOptions {
  orderBy?: ThreadOrderBy;
  sortDirection?: ThreadSortDirection;
}

export type ThreadOrderBy = 'createdAt' | 'updatedAt';

export type ThreadSortDirection = 'ASC' | 'DESC';

// Agent Storage Types

/**
 * Scorer reference with optional sampling configuration
 */
export interface StorageScorerConfig {
  /** Sampling configuration for this scorer */
  sampling?: {
    type: 'ratio' | 'count';
    rate?: number;
    count?: number;
  };
}

/**
 * Storage format for memory configuration.
 * Uses an object structure to allow future extensibility.
 */
export interface StorageMemoryConfig {
  /** Memory key to resolve from Mastra's memory registry */
  id: string;
}

/**
 * Stored agent configuration type.
 * Primitives (tools, workflows, agents, memory, scorers) are stored as references
 * that get resolved from Mastra's registries at runtime.
 */
export interface StorageAgentType {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  /** Model configuration (provider, name, etc.) */
  model: Record<string, unknown>;
  /** Array of tool keys to resolve from Mastra's tool registry */
  tools?: string[];
  /** Default options for generate/stream calls */
  defaultOptions?: Record<string, unknown>;
  /** Array of workflow keys to resolve from Mastra's workflow registry */
  workflows?: string[];
  /** Array of agent keys to resolve from Mastra's agent registry */
  agents?: string[];
  /** Array of integration IDs (for backward compatibility, not used for tool selection) */
  integrations?: string[];
  /**
   * Array of specific integration tool IDs selected for this agent.
   * Format: "provider_toolkitSlug_toolSlug" (e.g., "composio_hackernews_HACKERNEWS_GET_FRONTPAGE")
   */
  integrationTools?: string[];
  /** Input processor configurations */
  inputProcessors?: Record<string, unknown>[];
  /** Output processor configurations */
  outputProcessors?: Record<string, unknown>[];
  /** Memory configuration to resolve from Mastra's memory registry */
  memory?: StorageMemoryConfig;
  /** Scorer keys with optional sampling config, to resolve from Mastra's scorer registry */
  scorers?: Record<string, StorageScorerConfig>;
  /** Additional metadata for the agent */
  metadata?: Record<string, unknown>;
  /** Owner identifier for multi-tenant filtering */
  ownerId?: string;
  /** FK to agent_versions.id - the currently active version */
  activeVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a versioned snapshot of an agent's configuration.
 * Used for tracking changes and enabling rollback capabilities.
 */
export interface StorageAgentVersionType {
  /** Unique identifier (UUID) */
  id: string;
  /** Reference to the parent agent */
  agentId: string;
  /** Sequential version number */
  versionNumber: number;
  /** Optional vanity name for this version */
  name?: string;
  /** Full agent configuration snapshot */
  snapshot: Record<string, unknown>;
  /** Array of field names that changed in this version */
  changedFields?: string[];
  /** Optional message describing the changes */
  changeMessage?: string;
  createdAt: Date;
}

export type StorageCreateAgentInput = Omit<StorageAgentType, 'createdAt' | 'updatedAt'>;

export type StorageUpdateAgentInput = {
  id: string;
  name?: string;
  description?: string;
  instructions?: string;
  model?: Record<string, unknown>;
  /** Array of tool keys to resolve from Mastra's tool registry */
  tools?: string[];
  defaultOptions?: Record<string, unknown>;
  /** Array of workflow keys to resolve from Mastra's workflow registry */
  workflows?: string[];
  /** Array of agent keys to resolve from Mastra's agent registry */
  agents?: string[];
  /** Array of integration IDs (for backward compatibility) */
  integrations?: string[];
  /** Array of specific integration tool IDs (format: provider_toolkitSlug_toolSlug) */
  integrationTools?: string[];
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  /** Memory configuration to resolve from Mastra's memory registry */
  memory?: StorageMemoryConfig;
  /** Scorer keys with optional sampling config */
  scorers?: Record<string, StorageScorerConfig>;
  metadata?: Record<string, unknown>;
  /** Owner identifier for multi-tenant filtering */
  ownerId?: string;
  /** FK to agent_versions.id - the currently active version */
  activeVersionId?: string;
};

export type StorageListAgentsInput = {
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 100 if not specified.
   */
  perPage?: number | false;
  /**
   * Zero-indexed page number for pagination.
   * Defaults to 0 if not specified.
   */
  page?: number;
  orderBy?: StorageOrderBy;
  /**
   * Filter agents by owner identifier (indexed for fast lookups).
   * Only agents with matching ownerId will be returned.
   */
  ownerId?: string;
  /**
   * Filter agents by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
};

export type StorageListAgentsOutput = PaginationInfo & {
  agents: StorageAgentType[];
};

// Integration Storage Types

/**
 * Integration provider type for external tool platforms.
 */
export type IntegrationProvider = 'composio' | 'arcade' | 'mcp';

/**
 * Stored integration configuration type.
 * Represents a configured integration with an external tool provider.
 */
export interface StorageIntegrationConfig {
  /** Unique identifier (UUID) */
  id: string;
  /** Integration provider type */
  provider: IntegrationProvider;
  /** Display name for this integration */
  name: string;
  /** Whether this integration is active */
  enabled: boolean;
  /** Array of toolkit/app slugs selected from the provider */
  selectedToolkits: string[];
  /** Provider-specific settings and configuration */
  metadata?: Record<string, unknown>;
  /** Owner identifier for multi-tenant filtering */
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cached tool definition from an integration provider.
 * Stores the full tool specification to avoid repeated API calls.
 */
export interface StorageCachedTool {
  /** Unique identifier (UUID) */
  id: string;
  /** Reference to the parent integration */
  integrationId: string;
  /** Provider that this tool comes from */
  provider: IntegrationProvider;
  /** Toolkit/app slug that this tool belongs to */
  toolkitSlug: string;
  /** Unique tool slug/identifier from the provider */
  toolSlug: string;
  /** Display name for the tool */
  name: string;
  /** Tool description */
  description?: string;
  /** JSON schema for tool input parameters */
  inputSchema: Record<string, unknown>;
  /** JSON schema for tool output (optional) */
  outputSchema?: Record<string, unknown>;
  /** Raw tool definition from provider API */
  rawDefinition: Record<string, unknown>;
  /** When this tool definition was first created */
  createdAt: Date;
  /** When this tool definition was cached */
  cachedAt: Date;
  /** Last time this tool definition was updated */
  updatedAt: Date;
}

export type StorageCreateIntegrationInput = Omit<StorageIntegrationConfig, 'createdAt' | 'updatedAt'>;

export type StorageUpdateIntegrationInput = {
  id: string;
  name?: string;
  enabled?: boolean;
  selectedToolkits?: string[];
  metadata?: Record<string, unknown>;
  ownerId?: string;
};

export type StorageCachedToolInput = Omit<StorageCachedTool, 'createdAt' | 'cachedAt' | 'updatedAt'>;

export type StorageListIntegrationsInput = {
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 100 if not specified.
   */
  perPage?: number | false;
  /**
   * Zero-indexed page number for pagination.
   * Defaults to 0 if not specified.
   */
  page?: number;
  orderBy?: StorageOrderBy;
  /**
   * Filter integrations by owner identifier.
   * Only integrations with matching ownerId will be returned.
   */
  ownerId?: string;
  /**
   * Filter integrations by provider.
   */
  provider?: IntegrationProvider;
  /**
   * Filter integrations by enabled status.
   */
  enabled?: boolean;
};

export type StorageListIntegrationsOutput = PaginationInfo & {
  integrations: StorageIntegrationConfig[];
};

export type StorageListCachedToolsInput = {
  /**
   * Filter by integration ID.
   */
  integrationId?: string;
  /**
   * Filter by provider.
   */
  provider?: IntegrationProvider;
  /**
   * Filter by toolkit slug.
   */
  toolkitSlug?: string;
  /**
   * Number of items per page, or `false` to fetch all records without pagination limit.
   * Defaults to 100 if not specified.
   */
  perPage?: number | false;
  /**
   * Zero-indexed page number for pagination.
   * Defaults to 0 if not specified.
   */
  page?: number;
  orderBy?: {
    field?: 'cachedAt' | 'updatedAt';
    direction?: ThreadSortDirection;
  };
};

export type StorageListCachedToolsOutput = PaginationInfo & {
  tools: StorageCachedTool[];
};

// Workflow Definition Types

/**
 * Variable reference for input mapping - references a value from workflow context
 */
export type VariableRef = { $ref: string };

/**
 * Literal value wrapper for input mapping
 */
export type LiteralValue = { $literal: unknown };

/**
 * Either a variable reference or a literal value
 */
export type ValueOrRef = VariableRef | LiteralValue;

/**
 * Operators for condition comparisons
 */
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'in'
  | 'isNull'
  | 'isNotNull';

/**
 * Condition definitions for branch/loop logic
 */
export type ConditionDef =
  | { type: 'compare'; field: VariableRef; operator: ConditionOperator; value?: ValueOrRef }
  | { type: 'and'; conditions: ConditionDef[] }
  | { type: 'or'; conditions: ConditionDef[] }
  | { type: 'not'; condition: ConditionDef }
  | { type: 'expr'; expression: string };

// Declarative Step Definitions

/**
 * Agent step - executes an agent with given input
 */
export interface AgentStepDef {
  type: 'agent';
  agentId: string;
  input: { prompt: VariableRef; instructions?: string | VariableRef };
  structuredOutput?: Record<string, unknown>;
}

/**
 * Tool step - executes a tool with given input
 */
export interface ToolStepDef {
  type: 'tool';
  toolId: string;
  input: Record<string, ValueOrRef>;
}

/**
 * Workflow step - executes a nested workflow
 */
export interface WorkflowStepDef {
  type: 'workflow';
  workflowId: string;
  input: Record<string, ValueOrRef>;
}

/**
 * Transform step - transforms data and optionally updates state
 */
export interface TransformStepDef {
  type: 'transform';
  output: Record<string, ValueOrRef>;
  outputSchema: Record<string, unknown>;
  stateUpdates?: Record<string, ValueOrRef>;
}

/**
 * Suspend step - suspends workflow execution until resumed
 */
export interface SuspendStepDef {
  type: 'suspend';
  resumeSchema: Record<string, unknown>;
  payload?: Record<string, ValueOrRef>;
}

/**
 * Union of all declarative step definition types
 */
export type DeclarativeStepDefinition =
  | AgentStepDef
  | ToolStepDef
  | WorkflowStepDef
  | TransformStepDef
  | SuspendStepDef;

// Step Graph Entries

/**
 * Step graph flow entry types for defining workflow execution order
 */
export type DefinitionStepFlowEntry =
  | { type: 'step'; step: { id: string; description?: string } }
  | { type: 'sleep'; id: string; duration: number }
  | { type: 'sleepUntil'; id: string; timestamp: ValueOrRef }
  | { type: 'parallel'; steps: Array<{ type: 'step'; step: { id: string } }> }
  | { type: 'conditional'; branches: Array<{ condition: ConditionDef; stepId: string }>; default?: string }
  | { type: 'loop'; stepId: string; condition: ConditionDef; loopType: 'dowhile' | 'dountil' }
  | { type: 'foreach'; stepId: string; collection: VariableRef; concurrency?: number }
  | { type: 'map'; output: Record<string, ValueOrRef> };

// Main Storage Types

/**
 * Stored workflow definition type
 */
export interface StorageWorkflowDefinitionType {
  id: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  stepGraph: DefinitionStepFlowEntry[];
  steps: Record<string, DeclarativeStepDefinition>;
  retryConfig?: { attempts?: number; delay?: number };
  ownerId?: string;
  activeVersionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workflow definition version for tracking changes
 */
export interface StorageWorkflowDefinitionVersionType {
  id: string;
  workflowDefinitionId: string;
  versionNumber: number;
  name?: string;
  snapshot: StorageWorkflowDefinitionType;
  changedFields?: string[];
  changeMessage?: string;
  createdAt: Date;
}

// CRUD Input Types

/**
 * Input for creating a workflow definition
 */
export type StorageCreateWorkflowDefinitionInput = Omit<StorageWorkflowDefinitionType, 'createdAt' | 'updatedAt'>;

/**
 * Input for updating a workflow definition
 */
export type StorageUpdateWorkflowDefinitionInput = { id: string } & Partial<
  Omit<StorageWorkflowDefinitionType, 'id' | 'createdAt' | 'updatedAt'>
>;

/**
 * Input for listing workflow definitions
 */
export interface StorageListWorkflowDefinitionsInput {
  page?: number;
  perPage?: number | false;
  orderBy?: StorageOrderBy;
  ownerId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Output for listing workflow definitions
 */
export interface StorageListWorkflowDefinitionsOutput extends PaginationInfo {
  definitions: StorageWorkflowDefinitionType[];
}

// Basic Index Management Types
export interface CreateIndexOptions {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  concurrent?: boolean;
  /**
   * SQL WHERE clause for creating partial indexes.
   * @internal Reserved for internal use only. Callers must pre-validate this value.
   * DDL statements cannot use parameterized queries for WHERE clauses, so this value
   * is concatenated directly into the SQL. Any user-facing usage must validate input.
   */
  where?: string;
  method?: 'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin';
  opclass?: string; // Operator class for GIN/GIST indexes
  storage?: Record<string, any>; // Storage parameters
  tablespace?: string; // Tablespace name
}

export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  size: string;
  definition: string;
}

export interface StorageIndexStats extends IndexInfo {
  scans: number; // Number of index scans
  tuples_read: number; // Number of tuples read
  tuples_fetched: number; // Number of tuples fetched
  last_used?: Date; // Last time index was used
  method?: string; // Index method (btree, hash, etc)
}

// Workflow Storage Types
export interface UpdateWorkflowStateOptions {
  status: WorkflowRunStatus;
  result?: StepResult<any, any, any, any>;
  error?: SerializedError;
  suspendedPaths?: Record<string, number[]>;
  waitingPaths?: Record<string, number[]>;
}

/**
 * Get the inner type from a wrapper schema (nullable, optional, default, effects, branded).
 * Compatible with both Zod 3 and Zod 4.
 */
function getInnerType(schema: z.ZodTypeAny, typeName: string): z.ZodTypeAny | undefined {
  const schemaAny = schema as any;

  // For nullable, optional, default - the inner type is at _def.innerType
  if (typeName === 'ZodNullable' || typeName === 'ZodOptional' || typeName === 'ZodDefault') {
    return schemaAny._zod?.def?.innerType ?? schemaAny._def?.innerType;
  }

  // For effects - the inner type is at _def.schema
  if (typeName === 'ZodEffects') {
    return schemaAny._zod?.def?.schema ?? schemaAny._def?.schema;
  }

  // For branded - the inner type is at _def.type
  if (typeName === 'ZodBranded') {
    return schemaAny._zod?.def?.type ?? schemaAny._def?.type;
  }

  return undefined;
}

function unwrapSchema(schema: z.ZodTypeAny): { base: z.ZodTypeAny; nullable: boolean } {
  let current = schema;
  let nullable = false;

  while (true) {
    const typeName = getZodTypeName(current);

    if (typeName === 'ZodNullable') {
      nullable = true;
      const inner = getInnerType(current, typeName);
      if (inner) {
        current = inner;
        continue;
      }
    }

    if (typeName === 'ZodOptional') {
      // For DB purposes, we usually treat "optional" as "nullable"
      nullable = true;
      const inner = getInnerType(current, typeName);
      if (inner) {
        current = inner;
        continue;
      }
    }

    if (typeName === 'ZodDefault') {
      const inner = getInnerType(current, typeName);
      if (inner) {
        current = inner;
        continue;
      }
    }

    if (typeName === 'ZodEffects') {
      const inner = getInnerType(current, typeName);
      if (inner) {
        current = inner;
        continue;
      }
    }

    if (typeName === 'ZodBranded') {
      const inner = getInnerType(current, typeName);
      if (inner) {
        current = inner;
        continue;
      }
    }

    // If you ever use ZodCatch/ZodPipeline, you can unwrap them here too.
    break;
  }

  return { base: current, nullable };
}

/**
 * Extract checks array from Zod schema, compatible with both Zod 3 and Zod 4.
 * Zod 3 uses _def.checks, Zod 4 uses _zod.def.checks.
 */
function getZodChecks(schema: z.ZodTypeAny): Array<{ kind: string }> {
  const schemaAny = schema as any;
  // Zod 4 structure
  if (schemaAny._zod?.def?.checks) {
    return schemaAny._zod.def.checks;
  }
  // Zod 3 structure
  if (schemaAny._def?.checks) {
    return schemaAny._def.checks;
  }
  return [];
}

function zodToStorageType(schema: z.ZodTypeAny): StorageColumnType {
  const typeName = getZodTypeName(schema);

  if (typeName === 'ZodString') {
    // Check for UUID validation
    const checks = getZodChecks(schema);
    if (checks.some(c => c.kind === 'uuid')) {
      return 'uuid';
    }
    return 'text';
  }
  if (typeName === 'ZodNativeEnum' || typeName === 'ZodEnum') {
    return 'text';
  }
  if (typeName === 'ZodNumber') {
    // Check for integer validation
    const checks = getZodChecks(schema);
    return checks.some(c => c.kind === 'int') ? 'integer' : 'float';
  }
  if (typeName === 'ZodBigInt') {
    return 'bigint';
  }
  if (typeName === 'ZodDate') {
    return 'timestamp';
  }
  if (typeName === 'ZodBoolean') {
    return 'boolean';
  }
  // fall back for objects/records/unknown
  return 'jsonb';
}

/**
 * Converts a zod schema into a database schema
 * @param zObject A zod schema object
 * @returns database schema record with StorageColumns
 */
export function buildStorageSchema<Shape extends z.ZodRawShape>(
  zObject: z.ZodObject<Shape>,
): Record<keyof Shape & string, StorageColumn> {
  const shape = zObject.shape;
  const result: Record<string, StorageColumn> = {};

  for (const [key, field] of Object.entries(shape)) {
    const { base, nullable } = unwrapSchema(field as z.ZodTypeAny);
    result[key] = {
      type: zodToStorageType(base),
      nullable,
    };
  }

  return result as Record<keyof Shape & string, StorageColumn>;
}
