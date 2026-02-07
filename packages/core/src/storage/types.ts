import type { z } from 'zod';
import type { AgentExecutionOptionsBase } from '../agent/agent.types';
import type { SerializedError } from '../error';
import type { ScoringSamplingConfig } from '../evals/types';
import type { MastraDBMessage, StorageThreadType, SerializedMemoryConfig } from '../memory/types';
import { getZodInnerType, getZodTypeName } from '../utils/zod-utils';
import type { StepResult, WorkflowRunState, WorkflowRunStatus } from '../workflows';
import type { TABLE_NAMES } from './constants';

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

/**
 * Schema extensions allow users to add custom columns to Mastra's built-in tables.
 * Custom columns are real database columns (not JSONB metadata), enabling proper
 * indexing, type checking, and efficient queries.
 *
 * Maps table name to a record of column name → column definition.
 *
 * @example
 * ```typescript
 * const extensions: SchemaExtensions = {
 *   mastra_threads: {
 *     organizationId: { type: 'text', nullable: false },
 *     priority: { type: 'integer', nullable: true },
 *   },
 * };
 * ```
 */
export type SchemaExtensions = Partial<Record<TABLE_NAMES, Record<string, StorageColumn>>>;
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

/**
 * Common options for listing messages (pagination, filtering, ordering)
 */
type StorageListMessagesOptions = {
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

/**
 * Input for listing messages by thread ID.
 * The resource ID can be optionally provided to filter messages within the thread.
 */
export type StorageListMessagesInput = StorageListMessagesOptions & {
  /**
   * Thread ID(s) to query messages from.
   */
  threadId: string | string[];
  /**
   * Optional resource ID to further filter messages within the thread(s).
   */
  resourceId?: string;
};

export type StorageListMessagesOutput = PaginationInfo & {
  messages: MastraDBMessage[];
};

/**
 * Input for listing messages by resource ID only (across all threads).
 * Used by Observational Memory and LongMemEval for resource-scoped queries.
 */
export type StorageListMessagesByResourceIdInput = StorageListMessagesOptions & {
  /**
   * Resource ID to query ALL messages for the resource across all threads.
   */
  resourceId: string;
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

export type StorageListThreadsInput = {
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
   * Filter options for querying threads.
   */
  filter?: {
    /**
     * Filter threads by resource ID.
     */
    resourceId?: string;
    /**
     * Filter threads by metadata key-value pairs.
     * All specified key-value pairs must match (AND logic).
     */
    metadata?: Record<string, unknown>;
    /**
     * Filter threads by custom column values declared via schemaExtensions.
     * All specified key-value pairs must match (AND logic).
     * Keys must correspond to columns declared in the store's schemaExtensions config.
     */
    customColumns?: Record<string, unknown>;
  };
};

export type StorageListThreadsOutput = PaginationInfo & {
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
  sampling?: ScoringSamplingConfig;
}

/**
 * Model configuration stored in agent snapshots.
 */
export interface StorageModelConfig {
  /** Model provider (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Model name (e.g., 'gpt-4o', 'claude-3-opus') */
  name: string;
  /** Temperature for generation */
  temperature?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Maximum completion tokens */
  maxCompletionTokens?: number;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

/**
 * Default options stored in agent snapshots.
 * Based on AgentExecutionOptionsBase but omitting non-serializable properties.
 *
 * Non-serializable properties that are omitted:
 * - Callbacks (onStepFinish, onFinish, onChunk, onError, onAbort, prepareStep)
 * - Runtime objects (requestContext, abortSignal, tracingContext)
 * - Functions and processor instances (inputProcessors, outputProcessors, clientTools, scorers)
 * - Tools/toolsets (contain functions, stored separately as references)
 * - Complex types (context, memory, instructions, system, stopWhen)
 */
export type StorageDefaultOptions = Omit<
  AgentExecutionOptionsBase<any>,
  // Callback functions
  | 'onStepFinish'
  | 'onFinish'
  | 'onChunk'
  | 'onError'
  | 'onAbort'
  | 'prepareStep'
  // Runtime objects
  | 'abortSignal'
  | 'requestContext'
  | 'tracingContext'
  // Functions and processor instances
  | 'inputProcessors'
  | 'outputProcessors'
  | 'clientTools'
  | 'scorers'
  | 'toolsets'
  // Complex types
  | 'context' // ModelMessage includes complex content types (images, files)
  | 'memory' // AgentMemoryOption might contain runtime memory instances
  | 'instructions' // SystemMessage can be arrays or complex message objects
  | 'system' // SystemMessage can be arrays or complex message objects
  | 'stopWhen' // StopCondition is a complex union type from AI SDK
  | 'providerOptions' // ProviderOptions includes provider-specific types from external packages
>;

/**
 * Agent version snapshot type containing ALL agent configuration fields.
 * These fields live exclusively in version snapshot rows, not on the agent record.
 */
export interface StorageAgentSnapshotType {
  /** Display name of the agent */
  name: string;
  /** Purpose description */
  description?: string;
  /** System instructions/prompt — plain string for backward compatibility, or array of instruction blocks */
  instructions: string | AgentInstructionBlock[];
  /** Model configuration (provider, name, etc.) */
  model: StorageModelConfig;
  /** Array of tool keys to resolve from Mastra's tool registry */
  tools?: string[];
  /** Default options for generate/stream calls */
  defaultOptions?: StorageDefaultOptions;
  /** Array of workflow keys to resolve from Mastra's workflow registry */
  workflows?: string[];
  /** Array of agent keys to resolve from Mastra's agent registry */
  agents?: string[];
  /**
   * Array of specific integration tool IDs selected for this agent.
   * Format: "provider_toolkitSlug_toolSlug" (e.g., "composio_hackernews_HACKERNEWS_GET_FRONTPAGE")
   */
  integrationTools?: string[];
  /** Array of processor keys to resolve from Mastra's processor registry */
  inputProcessors?: string[];
  /** Array of processor keys to resolve from Mastra's processor registry */
  outputProcessors?: string[];
  /** Memory configuration object */
  memory?: SerializedMemoryConfig;
  /** Scorer keys with optional sampling config, to resolve from Mastra's scorer registry */
  scorers?: Record<string, StorageScorerConfig>;
}

/**
 * Thin agent record type containing only metadata fields.
 * All configuration lives in version snapshots (StorageAgentSnapshotType).
 */
export interface StorageAgentType {
  /** Unique, immutable identifier */
  id: string;
  /** Agent status: 'draft' on creation, 'published' when a version is activated */
  status: string;
  /** FK to agent_versions.id - the currently active version */
  activeVersionId?: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the agent */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved agent type that combines the thin agent record with version snapshot config.
 * Returned by getAgentByIdResolved and listAgentsResolved.
 */
export type StorageResolvedAgentType = StorageAgentType & StorageAgentSnapshotType;

/**
 * Input for creating a new agent. Flat union of thin record fields
 * and initial configuration (used to create version 1).
 */
export type StorageCreateAgentInput = {
  /** Unique identifier for the agent */
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the agent */
  metadata?: Record<string, unknown>;
} & StorageAgentSnapshotType;

/**
 * Input for updating an agent. Includes metadata-level fields and optional config fields.
 * The handler layer separates these into agent-record updates vs new-version creation.
 *
 * Memory can be set to `null` to explicitly disable/remove memory from the agent.
 */
export type StorageUpdateAgentInput = {
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the agent */
  metadata?: Record<string, unknown>;
  /** FK to agent_versions.id - the currently active version */
  activeVersionId?: string;
  /** Agent status: 'draft' or 'published' */
  status?: string;
} & Partial<Omit<StorageAgentSnapshotType, 'memory'>> & {
    /** Memory configuration object, or null to disable memory */
    memory?: SerializedMemoryConfig | null;
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
   * Filter agents by author identifier (indexed for fast lookups).
   * Only agents with matching authorId will be returned.
   */
  authorId?: string;
  /**
   * Filter agents by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
};

export type StorageListAgentsOutput = PaginationInfo & {
  agents: StorageAgentType[];
};

export type StorageListAgentsResolvedOutput = PaginationInfo & {
  agents: StorageResolvedAgentType[];
};

// ============================================
// Prompt Block Storage Types
// ============================================

/** Instruction block discriminated union, stored in agent snapshots */
export type AgentInstructionBlock =
  | { type: 'text'; content: string }
  | { type: 'prompt_block_ref'; id: string }
  | { type: 'prompt_block'; content: string; rules?: RuleGroup };

/** Condition operators for rule evaluation */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

/** Leaf rule: evaluates a single condition against a context field */
export interface Rule {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

/** Recursive rule group for AND/OR logic */
export interface RuleGroup {
  operator: 'AND' | 'OR';
  conditions: (Rule | RuleGroup)[];
}

/**
 * Thin prompt block record (metadata only).
 * All configuration lives in version snapshots (StoragePromptBlockSnapshotType).
 */
export interface StoragePromptBlockType {
  /** Unique identifier */
  id: string;
  /** Block status: 'draft' on creation, 'published' when a version is activated */
  status: 'draft' | 'published' | 'archived';
  /** FK to prompt_block_versions.id — the currently active version */
  activeVersionId?: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prompt block version snapshot containing the content fields.
 * These fields live exclusively in version snapshot rows.
 */
export interface StoragePromptBlockSnapshotType {
  /** Display name of the prompt block */
  name: string;
  /** Purpose description */
  description?: string;
  /** Template content with {{variable}} interpolation */
  content: string;
  /** Rules for conditional inclusion */
  rules?: RuleGroup;
}

/** Resolved prompt block: thin record merged with active version snapshot */
export type StorageResolvedPromptBlockType = StoragePromptBlockType & StoragePromptBlockSnapshotType;

/** Input for creating a new prompt block */
export type StorageCreatePromptBlockInput = {
  /** Unique identifier for the prompt block */
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
} & StoragePromptBlockSnapshotType;

/** Input for updating a prompt block */
export type StorageUpdatePromptBlockInput = {
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** FK to prompt_block_versions.id — the currently active version */
  activeVersionId?: string;
  /** Block status */
  status?: string;
} & Partial<StoragePromptBlockSnapshotType>;

export type StorageListPromptBlocksInput = {
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
   * Filter prompt blocks by author identifier.
   */
  authorId?: string;
  /**
   * Filter prompt blocks by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
};

/** Paginated list output for thin prompt block records */
export type StorageListPromptBlocksOutput = PaginationInfo & {
  promptBlocks: StoragePromptBlockType[];
};

/** Paginated list output for resolved prompt blocks */
export type StorageListPromptBlocksResolvedOutput = PaginationInfo & {
  promptBlocks: StorageResolvedPromptBlockType[];
};

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

// ============================================
// Observational Memory Types
// ============================================

/**
 * Scope of observational memory
 */
export type ObservationalMemoryScope = 'thread' | 'resource';

/**
 * How the observational memory record was created
 */
export type ObservationalMemoryOriginType = 'initial' | 'reflection';

/**
 * Core database record for observational memory
 *
 * For resource scope: One active record per resource, containing observations from ALL threads.
 * For thread scope: One record per thread.
 *
 * Derived values (not stored, computed at runtime):
 * - reflectionCount: count records with originType: 'reflection'
 * - lastReflectionAt: createdAt of most recent reflection record
 * - previousGeneration: record with next-oldest createdAt
 */
export interface ObservationalMemoryRecord {
  // Identity
  /** Unique record ID */
  id: string;
  /** Memory scope - thread or resource */
  scope: ObservationalMemoryScope;
  /** Thread ID (null for resource scope) */
  threadId: string | null;
  /** Resource ID (always present) */
  resourceId: string;

  // Timestamps (top-level for easy querying)
  /** When this record was created */
  createdAt: Date;
  /** When this record was last updated */
  updatedAt: Date;
  /**
   * Single cursor for message loading - when we last observed ANY thread for this resource.
   * Undefined means no observations have been made yet (all messages are "unobserved").
   */
  lastObservedAt?: Date;

  // Generation tracking
  /** How this record was created */
  originType: ObservationalMemoryOriginType;
  /** Generation counter - incremented each time a reflection creates a new record */
  generationCount: number;

  // Observation content
  /**
   * Currently active observations.
   * For resource scope: Contains <thread id="...">...</thread> sections for attribution.
   * For thread scope: Plain observation text.
   */
  activeObservations: string;
  /** Observations waiting to be activated (async buffering) */
  bufferedObservations?: string;
  /** Reflection waiting to be swapped in (async buffering) */
  bufferedReflection?: string;

  /**
   * Message IDs observed in the current generation.
   * Used as a safeguard against re-observation if timestamp filtering fails.
   * Reset on reflection (new generation starts fresh).
   */
  observedMessageIds?: string[];

  /**
   * The timezone used when formatting dates for the Observer agent.
   * Stored for debugging and auditing observation dates.
   * Example: "America/Los_Angeles", "Europe/London"
   */
  observedTimezone?: string;

  // Token tracking
  /** Running total of all tokens observed */
  totalTokensObserved: number;
  /** Current size of active observations */
  observationTokenCount: number;
  /** Accumulated tokens from pending (unobserved) messages across sessions */
  pendingMessageTokens: number;

  // State flags
  /** Is a reflection currently in progress? */
  isReflecting: boolean;
  /** Is observation currently in progress? */
  isObserving: boolean;

  // Configuration
  /** Current configuration (stored as JSON) */
  config: Record<string, unknown>;

  // Extensible metadata (app-specific, optional)
  /** Optional metadata for app-specific extensions */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new observational memory record
 */
export interface CreateObservationalMemoryInput {
  threadId: string | null;
  resourceId: string;
  scope: ObservationalMemoryScope;
  config: Record<string, unknown>;
  /** The timezone used when formatting dates for the Observer agent (e.g., "America/Los_Angeles") */
  observedTimezone?: string;
}

/**
 * Input for updating active observations.
 * Uses cursor-based message tracking via lastObservedAt instead of message IDs.
 */
export interface UpdateActiveObservationsInput {
  id: string;
  observations: string;
  tokenCount: number;
  /** Timestamp when these observations were created (for cursor-based message loading) */
  lastObservedAt: Date;
  /**
   * IDs of messages that were observed in this cycle.
   * Stored in record metadata as a safeguard against re-observation on process restart.
   * These are appended to any existing IDs and pruned to only include IDs newer than lastObservedAt.
   */
  observedMessageIds?: string[];
  /**
   * The timezone used when formatting dates for the Observer agent.
   * Captured from Intl.DateTimeFormat().resolvedOptions().timeZone
   */
  observedTimezone?: string;
}

/**
 * Input for updating buffered observations.
 * Note: Async buffering is currently disabled but types are retained for future use.
 */
export interface UpdateBufferedObservationsInput {
  id: string;
  observations: string;
  suggestedContinuation?: string;
}

/**
 * Input for creating a reflection generation (creates a new record, archives the old one)
 */
export interface CreateReflectionGenerationInput {
  currentRecord: ObservationalMemoryRecord;
  reflection: string;
  tokenCount: number;
}

// ============================================
// Workflow Storage Types
// ============================================

export interface UpdateWorkflowStateOptions {
  status: WorkflowRunStatus;
  result?: StepResult<any, any, any, any>;
  error?: SerializedError;
  suspendedPaths?: Record<string, number[]>;
  waitingPaths?: Record<string, number[]>;
  resumeLabels?: Record<string, { stepId: string; foreachIndex?: number }>;
}

function unwrapSchema(schema: z.ZodTypeAny): { base: z.ZodTypeAny; nullable: boolean } {
  let current = schema;
  let nullable = false;

  while (true) {
    const typeName = getZodTypeName(current);
    if (!typeName) break;

    if (typeName === 'ZodNullable' || typeName === 'ZodOptional') {
      nullable = true;
    }

    const inner = getZodInnerType(current, typeName);
    if (!inner) break;
    current = inner;
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
