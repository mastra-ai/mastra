import type { z } from 'zod';
import type { AgentExecutionOptionsBase } from '../agent/agent.types';
import type { SerializedError } from '../error';
import type { ScoringSamplingConfig } from '../evals/types';
import type { MastraDBMessage, StorageThreadType, SerializedMemoryConfig } from '../memory/types';
import type { ProcessorPhase } from '../processor-provider';
import { getZodInnerType, getZodTypeName } from '../utils/zod-utils';
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

export interface StorageTableConfig {
  columns: Record<string, StorageColumn>;
  compositePrimaryKey?: string[];
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
 * Per-tool configuration stored in agent snapshots.
 * Allows overriding the tool description for this specific agent.
 */
export interface StorageToolConfig {
  /** Custom description override for this tool in this agent context */
  description?: string;
  /** Conditional rules for when this tool should be available */
  rules?: RuleGroup;
}

/**
 * Per-MCP-client tool configuration stored in agent snapshots.
 * Specifies which tools from an MCP client are enabled and their overrides.
 * When `tools` is omitted, all tools from the MCP client/server are included.
 */
export interface StorageMCPClientToolsConfig {
  /** When omitted, all tools from the source are included. */
  tools?: Record<string, StorageToolConfig>;
}

/**
 * Scorer reference with optional sampling configuration
 */
export interface StorageScorerConfig {
  /** Custom description override for this scorer in this agent context */
  description?: string;
  /** Sampling configuration for this scorer */
  sampling?: ScoringSamplingConfig;
  /** Conditional rules for when this scorer should be active */
  rules?: RuleGroup;
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
 * A conditional variant: a value paired with an optional RuleGroup.
 * When rules are present, the value is only used if rules evaluate to true against the request context.
 * When rules are absent, the variant acts as the default/fallback.
 */
export interface StorageConditionalVariant<T> {
  value: T;
  rules?: RuleGroup;
}

/**
 * A field that can be either a static value or an array of conditional variants.
 * When an array of variants, all matching variants accumulate:
 * arrays are concatenated and objects are shallow-merged.
 * A variant with no rules always matches (acts as the default/base).
 */
export type StorageConditionalField<T> = T | StorageConditionalVariant<T>[];

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
  /** Model configuration (provider, name, etc.) — static or conditional on request context */
  model: StorageConditionalField<StorageModelConfig>;
  /** Tool keys with optional per-tool config — static or conditional on request context */
  tools?: StorageConditionalField<Record<string, StorageToolConfig>>;
  /** Default options for generate/stream calls — static or conditional on request context */
  defaultOptions?: StorageConditionalField<StorageDefaultOptions>;
  /** Workflow keys with optional per-workflow config — static or conditional on request context */
  workflows?: StorageConditionalField<Record<string, StorageToolConfig>>;
  /** Agent keys with optional per-agent config — static or conditional on request context */
  agents?: StorageConditionalField<Record<string, StorageToolConfig>>;
  /**
   * Map of tool provider IDs to their tool configurations.
   * Keys are provider IDs (e.g., "composio"), values configure which tools from that provider to include.
   * Static or conditional on request context.
   */
  integrationTools?: StorageConditionalField<Record<string, StorageMCPClientToolsConfig>>;
  /** Processor graph for input processing — static or conditional on request context */
  inputProcessors?: StorageConditionalField<StoredProcessorGraph>;
  /** Processor graph for output processing — static or conditional on request context */
  outputProcessors?: StorageConditionalField<StoredProcessorGraph>;
  /** Memory configuration object — static or conditional on request context */
  memory?: StorageConditionalField<SerializedMemoryConfig>;
  /** Scorer keys with optional sampling config — static or conditional on request context */
  scorers?: StorageConditionalField<Record<string, StorageScorerConfig>>;
  /** Map of stored MCP client IDs to their tool configurations — static or conditional on request context */
  mcpClients?: StorageConditionalField<Record<string, StorageMCPClientToolsConfig>>;
  /** Workspace reference — ID of a stored workspace or inline config — static or conditional on request context */
  workspace?: StorageConditionalField<StorageWorkspaceRef>;
  /** Skill entity IDs with optional per-skill overrides — static or conditional on request context */
  skills?: StorageConditionalField<Record<string, StorageSkillConfig>>;
  /** Skill format for system message injection (default: 'xml') */
  skillsFormat?: 'xml' | 'json' | 'markdown';
  /** JSON Schema for validating request context values. Stored as JSON Schema since Zod is not serializable. */
  requestContextSchema?: Record<string, unknown>;
}

/**
 * Thin agent record type containing only metadata fields.
 * All configuration lives in version snapshots (StorageAgentSnapshotType).
 */
export interface StorageAgentType {
  /** Unique, immutable identifier */
  id: string;
  /** Agent status: 'draft' on creation, 'published' when a version is activated */
  status: 'draft' | 'published' | 'archived';
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
export type StorageResolvedAgentType = StorageAgentType &
  StorageAgentSnapshotType & {
    /** The version ID that was resolved (populated by resolveEntity) */
    resolvedVersionId?: string;
  };

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
  status?: 'draft' | 'published' | 'archived';
} & Partial<Omit<StorageAgentSnapshotType, 'memory'>> & {
    /** Memory configuration object (static or conditional), or null to disable memory */
    memory?: StorageConditionalField<SerializedMemoryConfig> | null;
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
  /**
   * Filter agents by status.
   * Defaults to 'published' if not specified.
   */
  status?: 'draft' | 'published' | 'archived';
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

/**
 * Rule group with a fixed nesting depth of 3 levels.
 * Depth is capped to keep TypeScript and Zod/JSON-Schema types aligned
 * (recursive types cause infinite-depth issues in JSON Schema generation).
 *
 * Innermost groups (depth 2) may only contain leaf Rules.
 * Mid-level groups (depth 1) may contain Rules or depth-2 groups.
 * Top-level groups (depth 0, exported as `RuleGroup`) may contain Rules or depth-1 groups.
 */
export interface RuleGroupDepth2 {
  operator: 'AND' | 'OR';
  conditions: Rule[];
}

export interface RuleGroupDepth1 {
  operator: 'AND' | 'OR';
  conditions: (Rule | RuleGroupDepth2)[];
}

export interface RuleGroup {
  operator: 'AND' | 'OR';
  conditions: (Rule | RuleGroupDepth1)[];
}

// ============================================================================
// Stored Processor Graph Types
// ============================================================================

/**
 * A single processor step in a stored processor graph.
 * Each step references a ProcessorProvider by ID and stores its configuration.
 */
export interface ProcessorGraphStep {
  /** Unique ID for this step within the graph */
  id: string;
  /** The ProcessorProvider ID that created this processor */
  providerId: string;
  /** Configuration matching the provider's configSchema, validated at creation time */
  config: Record<string, unknown>;
  /** Which processor phases to enable (subset of the provider's availablePhases) */
  enabledPhases: ProcessorPhase[];
}

/**
 * Processor graph entry and condition types with a fixed nesting depth of 3 levels.
 * Depth is capped to keep TypeScript and Zod/JSON-Schema types aligned
 * (recursive types cause infinite-depth issues in JSON Schema generation).
 *
 * Innermost entries (depth 3) may only be step entries.
 * Mid-level entries (depth 2) may contain step, parallel, or conditional — children limited to depth 3.
 * Top-level entries (depth 1, exported as `ProcessorGraphEntry`) may contain step, parallel, or conditional — children limited to depth 2.
 */

/** Depth 3 (leaf): only step entries allowed */
export type ProcessorGraphEntryDepth3 = { type: 'step'; step: ProcessorGraphStep };

/** Condition at depth 2 — children are depth 3 entries */
export interface ProcessorGraphConditionDepth2 {
  steps: ProcessorGraphEntryDepth3[];
  rules?: RuleGroup;
}

/** Depth 2: step, parallel, and conditional — children limited to depth 3 */
export type ProcessorGraphEntryDepth2 =
  | { type: 'step'; step: ProcessorGraphStep }
  | { type: 'parallel'; branches: ProcessorGraphEntryDepth3[][] }
  | { type: 'conditional'; conditions: ProcessorGraphConditionDepth2[] };

/** Condition at depth 1 — children are depth 2 entries */
export interface ProcessorGraphCondition {
  /** The steps to execute if this condition's rules match */
  steps: ProcessorGraphEntryDepth2[];
  /** Rules to evaluate against the previous step's output. If absent, this is the default branch. */
  rules?: RuleGroup;
}

/** Depth 1 (top-level): step, parallel, and conditional — children limited to depth 2 */
export type ProcessorGraphEntry =
  | { type: 'step'; step: ProcessorGraphStep }
  | { type: 'parallel'; branches: ProcessorGraphEntryDepth2[][] }
  | { type: 'conditional'; conditions: ProcessorGraphCondition[] };

/**
 * A stored processor graph representing a pipeline of processors.
 * The entries are ordered: sequential flow is array order, with parallel/conditional branching.
 */
export interface StoredProcessorGraph {
  steps: ProcessorGraphEntry[];
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
  /** JSON Schema for validating request context values. Defines available variables for {{variableName}} interpolation and conditions. */
  requestContextSchema?: Record<string, unknown>;
}

/** Resolved prompt block: thin record merged with active version snapshot */
export type StorageResolvedPromptBlockType = StoragePromptBlockType &
  StoragePromptBlockSnapshotType & {
    resolvedVersionId?: string;
  };

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
  status?: 'draft' | 'published' | 'archived';
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
  /**
   * Filter prompt blocks by status.
   * Defaults to 'published' if not specified.
   */
  status?: 'draft' | 'published' | 'archived';
};

/** Paginated list output for thin prompt block records */
export type StorageListPromptBlocksOutput = PaginationInfo & {
  promptBlocks: StoragePromptBlockType[];
};

/** Paginated list output for resolved prompt blocks */
export type StorageListPromptBlocksResolvedOutput = PaginationInfo & {
  promptBlocks: StorageResolvedPromptBlockType[];
};

// ============================================
// Stored Scorer Types
// ============================================

/**
 * Scorer type discriminator.
 * - 'llm-judge': Custom LLM-as-judge scorer with user-provided instructions
 * - Preset types: Built-in scorers from @mastra/evals (e.g., 'bias', 'toxicity', 'faithfulness')
 */
export type StoredScorerType =
  | 'llm-judge'
  | 'answer-relevancy'
  | 'answer-similarity'
  | 'bias'
  | 'context-precision'
  | 'context-relevance'
  | 'faithfulness'
  | 'hallucination'
  | 'noise-sensitivity'
  | 'prompt-alignment'
  | 'tool-call-accuracy'
  | 'toxicity';

/**
 * Stored scorer version snapshot containing ALL scorer configuration fields.
 * These fields live exclusively in version snapshot rows, not on the scorer record.
 */
export interface StorageScorerDefinitionSnapshotType {
  /** Display name of the scorer */
  name: string;
  /** Purpose description */
  description?: string;
  /** Scorer type — determines how the scorer is instantiated at runtime */
  type: StoredScorerType;
  /** Model configuration — used for LLM judge; for presets, overrides the default model */
  model?: StorageModelConfig;
  /** System instructions for the judge LLM (used when type === 'llm-judge') */
  instructions?: string;
  /** Score range configuration (used when type === 'llm-judge') */
  scoreRange?: {
    /** Minimum score value (default: 0) */
    min?: number;
    /** Maximum score value (default: 1) */
    max?: number;
  };
  /** Serializable config options for preset scorers (e.g., { scale: 10, context: [...] }) */
  presetConfig?: Record<string, unknown>;
  /** Default sampling configuration */
  defaultSampling?: ScoringSamplingConfig;
}

/**
 * Thin stored scorer record type containing only metadata fields.
 * All configuration lives in version snapshots (StorageScorerDefinitionSnapshotType).
 */
export interface StorageScorerDefinitionType {
  /** Unique, immutable identifier */
  id: string;
  /** Scorer status: 'draft' on creation, 'published' when a version is activated */
  status: 'draft' | 'published' | 'archived';
  /** FK to scorer_definition_versions.id - the currently active version */
  activeVersionId?: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the scorer */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved stored scorer type that combines the thin record with version snapshot config.
 * Returned by getScorerDefinitionByIdResolved and listScorerDefinitionsResolved.
 */
export type StorageResolvedScorerDefinitionType = StorageScorerDefinitionType &
  StorageScorerDefinitionSnapshotType & {
    /** The version ID that was resolved (populated by resolveEntity) */
    resolvedVersionId?: string;
  };

/**
 * Input for creating a new stored scorer. Flat union of thin record fields
 * and initial configuration (used to create version 1).
 */
export type StorageCreateScorerDefinitionInput = {
  /** Unique identifier for the scorer */
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the scorer */
  metadata?: Record<string, unknown>;
} & StorageScorerDefinitionSnapshotType;

/**
 * Input for updating a stored scorer. Includes metadata-level fields and optional config fields.
 * The handler layer separates these into record updates vs new-version creation.
 */
export type StorageUpdateScorerDefinitionInput = {
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the scorer */
  metadata?: Record<string, unknown>;
  /** FK to scorer_definition_versions.id - the currently active version */
  activeVersionId?: string;
  /** Scorer status */
  status?: 'draft' | 'published' | 'archived';
} & Partial<StorageScorerDefinitionSnapshotType>;

export type StorageListScorerDefinitionsInput = {
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
   * Filter scorers by author identifier.
   */
  authorId?: string;
  /**
   * Filter scorers by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
  /**
   * Filter scorers by status.
   * Defaults to 'published' if not specified.
   */
  status?: 'draft' | 'published' | 'archived';
};

/** Paginated list output for thin stored scorer records */
export type StorageListScorerDefinitionsOutput = PaginationInfo & {
  scorerDefinitions: StorageScorerDefinitionType[];
};

/** Paginated list output for resolved stored scorers */
export type StorageListScorerDefinitionsResolvedOutput = PaginationInfo & {
  scorerDefinitions: StorageResolvedScorerDefinitionType[];
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
 * A chunk of buffered observations from a single observation cycle.
 * Multiple chunks can accumulate before being activated together.
 */
export interface BufferedObservationChunk {
  /** Unique identifier for this chunk */
  id: string;
  /** Cycle ID for linking to UI buffering markers */
  cycleId: string;
  /** The observation text content */
  observations: string;
  /** Token count of this chunk's observations */
  tokenCount: number;
  /** Message IDs that were observed in this chunk */
  messageIds: string[];
  /** Token count of the messages that were observed (for activation calculation) */
  messageTokens: number;
  /** When the messages were last observed */
  lastObservedAt: Date;
  /** When this chunk was created */
  createdAt: Date;
  /** Optional suggested continuation from the observer */
  suggestedContinuation?: string;
  /** Optional current task context */
  currentTask?: string;
}

/**
 * Input for creating a new buffered observation chunk.
 */
export interface BufferedObservationChunkInput {
  /** Cycle ID for linking to UI buffering markers */
  cycleId: string;
  /** The observation text content */
  observations: string;
  /** Token count of this chunk's observations */
  tokenCount: number;
  /** Message IDs that were observed in this chunk */
  messageIds: string[];
  /** Token count of the messages that were observed (for activation calculation) */
  messageTokens: number;
  /** When the messages were observed */
  lastObservedAt: Date;
  /** Optional suggested continuation from the observer */
  suggestedContinuation?: string;
  /** Optional current task context */
  currentTask?: string;
}

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
  /**
   * Array of buffered observation chunks waiting to be activated.
   * Each chunk represents observations from a single observation cycle.
   * Multiple chunks can accumulate before being activated together.
   */
  bufferedObservationChunks?: BufferedObservationChunk[];
  /**
   * @deprecated Use bufferedObservationChunks instead. Legacy field for backwards compatibility.
   * Observations waiting to be activated (async buffering)
   */
  bufferedObservations?: string;
  /**
   * @deprecated Use bufferedObservationChunks instead. Legacy field for backwards compatibility.
   * Token count of buffered observations
   */
  bufferedObservationTokens?: number;
  /**
   * @deprecated Use bufferedObservationChunks instead. Legacy field for backwards compatibility.
   * Message IDs being processed in async buffering
   */
  bufferedMessageIds?: string[];
  /** Reflection waiting to be swapped in (async buffering) */
  bufferedReflection?: string;
  /** Token count of buffered reflection (post-compression output) */
  bufferedReflectionTokens?: number;
  /** Observation tokens that were fed into the reflector (pre-compression input) */
  bufferedReflectionInputTokens?: number;
  /**
   * The number of lines in activeObservations that were reflected on
   * when the buffered reflection was created. Used at activation time
   * to separate reflected vs unreflected observations.
   */
  reflectedObservationLineCount?: number;

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
  /** Is async observation buffering currently in progress? */
  isBufferingObservation: boolean;
  /** Is async reflection buffering currently in progress? */
  isBufferingReflection: boolean;
  /**
   * The pending message token count at which the last async observation buffer was triggered.
   * Used to determine when the next bufferTokens interval is crossed.
   * Persisted so new instances (created per request) can pick up where the last left off.
   */
  lastBufferedAtTokens: number;
  /**
   * Timestamp cursor for buffered messages.
   * Set to the max message timestamp (+1ms) of the last successfully buffered chunk.
   * Used to filter out already-buffered messages when starting the next buffer.
   * Reset on activation.
   */
  lastBufferedAtTime: Date | null;

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
 * Used when async buffering is enabled via `bufferTokens` config.
 * Adds a new chunk to the bufferedObservationChunks array.
 */
export interface UpdateBufferedObservationsInput {
  id: string;
  /** The observation chunk to add to the buffer */
  chunk: BufferedObservationChunkInput;
  /** Timestamp cursor for the last buffered message boundary. Set to max message timestamp + 1ms. */
  lastBufferedAtTime?: Date;
}

/**
 * Input for swapping buffered observations to active.
 * Supports partial activation via `activationRatio`.
 */
export interface SwapBufferedToActiveInput {
  id: string;
  /**
   * Normalized ratio (0-1) controlling how much context to activate.
   * `1 - activationRatio` is the fraction of the threshold to keep as raw messages.
   * Target tokens to remove = `currentPendingTokens - messageTokensThreshold * (1 - activationRatio)`.
   * Chunks are selected by boundary, biased over the target (to ensure remaining context stays at or below the retention floor).
   *
   * Note: this is always a ratio. The caller resolves absolute `bufferActivation` values (> 1)
   * into the equivalent ratio before passing to the storage layer.
   */
  activationRatio: number;
  /**
   * The message token threshold (e.g., observation.messageTokens config value).
   * Used with `activationRatio` to compute the retention floor.
   */
  messageTokensThreshold: number;
  /**
   * Current total pending message tokens in the context window.
   * Used to compute how many tokens need to be removed to reach the retention floor.
   */
  currentPendingTokens: number;
  /**
   * When true, prefer removing more chunks (above `blockAfter`), while still respecting
   * the minimum remaining tokens safeguard (min(1000, retention floor)).
   */
  forceMaxActivation?: boolean;
  /**
   * Optional timestamp to use as lastObservedAt after swap.
   * If not provided, the adapter will use the lastObservedAt from the latest activated chunk.
   */
  lastObservedAt?: Date;
}

/**
 * Result from swapping buffered observations to active.
 * Contains info about what was activated for UI feedback.
 */
export interface SwapBufferedToActiveResult {
  /** Number of chunks that were activated */
  chunksActivated: number;
  /** Total message tokens from activated chunks (context cleared) */
  messageTokensActivated: number;
  /** Total observation tokens from activated chunks */
  observationTokensActivated: number;
  /** Total messages from activated chunks */
  messagesActivated: number;
  /** CycleIds of the activated chunks (for linking UI markers) */
  activatedCycleIds: string[];
  /** All message IDs from activated chunks (for removing from context) */
  activatedMessageIds: string[];
  /** Concatenated observations from activated chunks (for UI display) */
  observations?: string;
  /** Per-chunk breakdown for individual UI markers */
  perChunk?: Array<{
    cycleId: string;
    messageTokens: number;
    observationTokens: number;
    messageCount: number;
    observations: string;
  }>;
  /** Suggested continuation from the most recent activated chunk (if any) */
  suggestedContinuation?: string;
  /** Current task from the most recent activated chunk (if any) */
  currentTask?: string;
}

/**
 * Input for updating buffered reflection.
 * Used when async reflection buffering is enabled via `bufferTokens` config.
 */
export interface UpdateBufferedReflectionInput {
  id: string;
  reflection: string;
  /** Token count of the buffered reflection (post-compression output) */
  tokenCount: number;
  /** Observation tokens that were fed into the reflector (pre-compression input) */
  inputTokenCount: number;
  /**
   * The number of lines in activeObservations at the time of reflection.
   * Used at activation time to know which observations were already reflected on.
   */
  reflectedObservationLineCount: number;
}

/**
 * Input for swapping buffered reflection to active (creates new generation).
 * Uses the stored `reflectedObservationLineCount` to determine which observations
 * were already reflected on, replaces those with the buffered reflection,
 * and appends any unreflected observations that were added after the reflection started.
 */
export interface SwapBufferedReflectionToActiveInput {
  currentRecord: ObservationalMemoryRecord;
  /**
   * Token count for the combined new activeObservations (bufferedReflection + unreflected).
   * Computed by the processor using its token counter before calling the adapter.
   */
  tokenCount: number;
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
// MCP Client Storage Types
// ============================================

/**
 * Serializable MCP server transport definition for storage.
 * Only includes fields that can be safely serialized to JSON.
 * Non-serializable fields (fetch, authProvider, logger, etc.) must be
 * provided via code-defined MCP clients.
 */
export interface StorageMCPServerConfig {
  /** Transport type discriminator */
  type: 'stdio' | 'http';
  /** Command to execute (stdio transport) */
  command?: string;
  /** Arguments to pass to the command (stdio transport) */
  args?: string[];
  /** Environment variables for the subprocess (stdio transport) */
  env?: Record<string, string>;
  /** URL of the MCP server endpoint (http transport) — stored as string */
  url?: string;
  /** Timeout in milliseconds for server operations */
  timeout?: number;
  /**
   * Optional tool selection/filtering at the server level.
   * When provided, only tools listed here are exposed by this server.
   * When omitted, all tools from the server are exposed.
   */
  tools?: Record<string, StorageToolConfig>;
}

/**
 * MCP client version snapshot containing ALL configuration fields.
 * These fields live exclusively in version snapshot rows, not on the MCP client record.
 */
export interface StorageMCPClientSnapshotType {
  /** Display name of the MCP client configuration */
  name: string;
  /** Purpose description */
  description?: string;
  /** MCP servers keyed by server name */
  servers: Record<string, StorageMCPServerConfig>;
}

/**
 * Thin stored MCP client record type containing only metadata fields.
 * All configuration lives in version snapshots (StorageMCPClientSnapshotType).
 */
export interface StorageMCPClientType {
  /** Unique, immutable identifier */
  id: string;
  /** Client status: 'draft' on creation, 'published' when a version is activated */
  status: 'draft' | 'published' | 'archived';
  /** FK to mcp_client_versions.id - the currently active version */
  activeVersionId?: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the MCP client */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved stored MCP client type that combines the thin record with version snapshot config.
 * Returned by getMCPClientByIdResolved and listMCPClientsResolved.
 */
export type StorageResolvedMCPClientType = StorageMCPClientType &
  StorageMCPClientSnapshotType & {
    resolvedVersionId?: string;
  };

/**
 * Input for creating a new stored MCP client. Flat union of thin record fields
 * and initial configuration (used to create version 1).
 */
export type StorageCreateMCPClientInput = {
  /** Unique identifier for the MCP client */
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the MCP client */
  metadata?: Record<string, unknown>;
} & StorageMCPClientSnapshotType;

/**
 * Input for updating a stored MCP client. Includes metadata-level fields and optional config fields.
 * The handler layer separates these into record updates vs new-version creation.
 */
export type StorageUpdateMCPClientInput = {
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the MCP client */
  metadata?: Record<string, unknown>;
  /** FK to mcp_client_versions.id - the currently active version */
  activeVersionId?: string;
  /** Client status */
  status?: 'draft' | 'published' | 'archived';
} & Partial<StorageMCPClientSnapshotType>;

export type StorageListMCPClientsInput = {
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
   * Filter MCP clients by author identifier.
   */
  authorId?: string;
  /**
   * Filter MCP clients by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
  /**
   * Filter MCP clients by status.
   * Defaults to 'published' if not specified.
   */
  status?: 'draft' | 'published' | 'archived';
};

/** Paginated list output for thin stored MCP client records */
export type StorageListMCPClientsOutput = PaginationInfo & {
  mcpClients: StorageMCPClientType[];
};

/** Paginated list output for resolved stored MCP clients */
export type StorageListMCPClientsResolvedOutput = PaginationInfo & {
  mcpClients: StorageResolvedMCPClientType[];
};

// ============================================
// MCP Server Storage Types
// ============================================

/**
 * MCP server version snapshot containing ALL configuration fields.
 * These fields live exclusively in version snapshot rows, not on the MCP server record.
 *
 * Serializable metadata from MCPServerConfig. Non-serializable fields (tools, agents, workflows)
 * are stored as reference keys and resolved at hydration time.
 */
export interface StorageMCPServerSnapshotType {
  /** Display name of the MCP server */
  name: string;
  /** Semantic version string */
  version: string;
  /** Purpose description */
  description?: string;
  /** Instructions describing how to use the server */
  instructions?: string;
  /** Repository information for the server's source code */
  repository?: {
    url: string;
    type?: string;
    directory?: string;
  };
  /** Release date of this server version (ISO 8601 string) */
  releaseDate?: string;
  /** Whether this version is the latest available */
  isLatest?: boolean;
  /** Canonical packaging format (e.g., 'npm', 'docker', 'pypi', 'crates') */
  packageCanonical?: string;
  /**
   * Tool keys to include on this MCP server.
   * Keys are tool IDs registered in Mastra, values provide optional config overrides.
   */
  tools?: Record<string, StorageToolConfig>;
  /**
   * Agent keys to expose as tools on this MCP server.
   * Keys are agent IDs registered in Mastra, values provide optional config overrides.
   */
  agents?: Record<string, StorageToolConfig>;
  /**
   * Workflow keys to expose as tools on this MCP server.
   * Keys are workflow IDs registered in Mastra, values provide optional config overrides.
   */
  workflows?: Record<string, StorageToolConfig>;
}

/**
 * Thin stored MCP server record type containing only metadata fields.
 * All configuration lives in version snapshots (StorageMCPServerSnapshotType).
 */
export interface StorageMCPServerType {
  /** Unique, immutable identifier */
  id: string;
  /** Server status: 'draft' on creation, 'published' when a version is activated */
  status: 'draft' | 'published' | 'archived';
  /** FK to mcp_server_versions.id - the currently active version */
  activeVersionId?: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the MCP server */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved stored MCP server type that combines the thin record with version snapshot config.
 * Returned by getMCPServerByIdResolved and listMCPServersResolved.
 */
export type StorageResolvedMCPServerType = StorageMCPServerType &
  StorageMCPServerSnapshotType & {
    resolvedVersionId?: string;
  };

/**
 * Input for creating a new stored MCP server. Flat union of thin record fields
 * and initial configuration (used to create version 1).
 */
export type StorageCreateMCPServerInput = {
  /** Unique identifier for the MCP server */
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the MCP server */
  metadata?: Record<string, unknown>;
} & StorageMCPServerSnapshotType;

/**
 * Input for updating a stored MCP server. Includes metadata-level fields and optional config fields.
 * The handler layer separates these into record updates vs new-version creation.
 */
export type StorageUpdateMCPServerInput = {
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the MCP server */
  metadata?: Record<string, unknown>;
  /** FK to mcp_server_versions.id - the currently active version */
  activeVersionId?: string;
  /** Server status */
  status?: 'draft' | 'published' | 'archived';
} & Partial<StorageMCPServerSnapshotType>;

export type StorageListMCPServersInput = {
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
   * Filter MCP servers by author identifier.
   */
  authorId?: string;
  /**
   * Filter MCP servers by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
  /**
   * Filter MCP servers by status.
   * Defaults to 'published' if not specified.
   */
  status?: 'draft' | 'published' | 'archived';
};

/** Paginated list output for thin stored MCP server records */
export type StorageListMCPServersOutput = PaginationInfo & {
  mcpServers: StorageMCPServerType[];
};

/** Paginated list output for resolved stored MCP servers */
export type StorageListMCPServersResolvedOutput = PaginationInfo & {
  mcpServers: StorageResolvedMCPServerType[];
};

// ============================================
// Workspace Storage Types
// ============================================

/**
 * Serializable filesystem configuration for storage.
 * References a provider type string that the editor resolves at hydration time.
 */
export interface StorageFilesystemConfig {
  /** Provider type identifier (e.g., 's3', 'gcs', 'local') — resolved by the editor's filesystem registry */
  provider: string;
  /** Provider-specific configuration (bucket, basePath, etc.) */
  config: Record<string, unknown>;
  /** Whether the filesystem is read-only */
  readOnly?: boolean;
}

/**
 * Serializable sandbox configuration for storage.
 * References a provider type string that the editor resolves at hydration time.
 */
export interface StorageSandboxConfig {
  /** Provider type identifier (e.g., 'e2b') — resolved by the editor's sandbox registry */
  provider: string;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Serializable search configuration for storage.
 * References vector store and embedder by provider/name rather than runtime instances.
 */
export interface StorageSearchConfig {
  /** Vector store provider identifier (e.g., 'pg', 'pinecone') */
  vectorProvider?: string;
  /** Vector store provider-specific configuration */
  vectorConfig?: Record<string, unknown>;
  /** Embedder provider identifier (e.g., 'openai', 'fastembed') */
  embedderProvider?: string;
  /** Embedder model name */
  embedderModel?: string;
  /** Embedder provider-specific configuration */
  embedderConfig?: Record<string, unknown>;
  /** BM25 keyword search config — true for defaults, or object for custom params */
  bm25?: boolean | { k1?: number; b?: number };
  /** Custom index name for the vector store */
  searchIndexName?: string;
  /** Paths to auto-index on init */
  autoIndexPaths?: string[];
}

/**
 * Serializable per-tool configuration for workspace tools.
 */
export interface StorageWorkspaceToolConfig {
  /** Whether the tool is enabled (default: true) */
  enabled?: boolean;
  /** Whether the tool requires user approval before execution (default: false) */
  requireApproval?: boolean;
  /** For write tools: require reading a file before writing to it */
  requireReadBeforeWrite?: boolean;
}

/**
 * Serializable workspace tools configuration for storage.
 */
export interface StorageWorkspaceToolsConfig {
  /** Default: whether all tools are enabled (default: true) */
  enabled?: boolean;
  /** Default: whether all tools require user approval (default: false) */
  requireApproval?: boolean;
  /** Per-tool overrides, keyed by workspace tool name */
  tools?: Record<string, StorageWorkspaceToolConfig>;
}

/**
 * Workspace version snapshot type containing ALL workspace configuration fields.
 * These fields live exclusively in version snapshot rows, not on the workspace record.
 */
export interface StorageWorkspaceSnapshotType {
  /** Display name of the workspace */
  name: string;
  /** Purpose description */
  description?: string;
  /** Primary filesystem configuration */
  filesystem?: StorageFilesystemConfig;
  /** Sandbox configuration */
  sandbox?: StorageSandboxConfig;
  /** Mounted filesystems keyed by mount path */
  mounts?: Record<string, StorageFilesystemConfig>;
  /** Search configuration (vector, embedder, BM25) */
  search?: StorageSearchConfig;
  /** Skill entity IDs assigned to this workspace */
  skills?: string[];
  /** Workspace tool configuration */
  tools?: StorageWorkspaceToolsConfig;
  /** Auto-sync between fs and sandbox (default: false) */
  autoSync?: boolean;
  /** Timeout for individual operations in milliseconds */
  operationTimeout?: number;
}

/**
 * Thin workspace record type containing only metadata fields.
 * All configuration lives in version snapshots (StorageWorkspaceSnapshotType).
 */
export interface StorageWorkspaceType {
  /** Unique, immutable identifier */
  id: string;
  /** Workspace status: 'draft' on creation, 'published' when a version is activated */
  status: 'draft' | 'published' | 'archived';
  /** FK to workspace_versions.id - the currently active version */
  activeVersionId?: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the workspace */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved workspace type that combines the thin record with version snapshot config.
 * Returned by getWorkspaceByIdResolved and listWorkspacesResolved.
 */
export type StorageResolvedWorkspaceType = StorageWorkspaceType &
  StorageWorkspaceSnapshotType & {
    resolvedVersionId?: string;
  };

/**
 * Input for creating a new workspace. Flat union of thin record fields
 * and initial configuration (used to create version 1).
 */
export type StorageCreateWorkspaceInput = {
  /** Unique identifier for the workspace */
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the workspace */
  metadata?: Record<string, unknown>;
} & StorageWorkspaceSnapshotType;

/**
 * Input for updating a workspace. Includes metadata-level fields and optional config fields.
 * The handler layer separates these into record updates vs new-version creation.
 */
export type StorageUpdateWorkspaceInput = {
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** Additional metadata for the workspace */
  metadata?: Record<string, unknown>;
  /** FK to workspace_versions.id - the currently active version */
  activeVersionId?: string;
  /** Workspace status */
  status?: 'draft' | 'published' | 'archived';
} & Partial<StorageWorkspaceSnapshotType>;

export type StorageListWorkspacesInput = {
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
   * Filter workspaces by author identifier.
   */
  authorId?: string;
  /**
   * Filter workspaces by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
};

/** Paginated list output for thin workspace records */
export type StorageListWorkspacesOutput = PaginationInfo & {
  workspaces: StorageWorkspaceType[];
};

/** Paginated list output for resolved workspaces */
export type StorageListWorkspacesResolvedOutput = PaginationInfo & {
  workspaces: StorageResolvedWorkspaceType[];
};

// ============================================
// Skill Storage Types
// ============================================

/**
 * Serializable content source for skill storage.
 * Mirrors the runtime ContentSource but stored as plain JSON.
 */
export type StorageContentSource =
  | { type: 'external'; packagePath: string }
  | { type: 'local'; projectPath: string }
  | { type: 'managed'; mastraPath: string };

/**
 * Skill version snapshot type containing ALL skill definition fields.
 * These fields live exclusively in version snapshot rows, not on the skill record.
 */
export interface StorageSkillSnapshotType {
  /** Skill name (1-64 chars, lowercase, hyphens only) */
  name: string;
  /** Description of what the skill does and when to use it */
  description: string;
  /** Markdown instructions from SKILL.md body */
  instructions: string;
  /** Optional license identifier */
  license?: string;
  /** Optional compatibility requirements */
  compatibility?: unknown;
  /** Source of the skill */
  source?: StorageContentSource;
  /** List of reference file paths */
  references?: string[];
  /** List of script file paths */
  scripts?: string[];
  /** List of asset file paths */
  assets?: string[];
  /** Optional arbitrary metadata */
  metadata?: Record<string, unknown>;
  /** Content-addressable file tree manifest for this skill version */
  tree?: SkillVersionTree;
}

/**
 * Thin skill record type containing only metadata fields.
 * All definition content lives in version snapshots (StorageSkillSnapshotType).
 */
export interface StorageSkillType {
  /** Unique, immutable identifier */
  id: string;
  /** Skill status: 'draft' on creation, 'published' when a version is activated */
  status: 'draft' | 'published' | 'archived';
  /** FK to skill_versions.id - the currently active version */
  activeVersionId?: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolved skill type that combines the thin record with version snapshot content.
 * Returned by getSkillByIdResolved and listSkillsResolved.
 */
export type StorageResolvedSkillType = StorageSkillType &
  StorageSkillSnapshotType & {
    resolvedVersionId?: string;
  };

/**
 * Input for creating a new skill. Flat union of thin record fields
 * and initial content (used to create version 1).
 */
export type StorageCreateSkillInput = {
  /** Unique identifier for the skill */
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
} & StorageSkillSnapshotType;

/**
 * Input for updating a skill. Includes metadata-level fields and optional content fields.
 * The handler layer separates these into record updates vs new-version creation.
 */
export type StorageUpdateSkillInput = {
  id: string;
  /** Author identifier for multi-tenant filtering */
  authorId?: string;
  /** FK to skill_versions.id - the currently active version */
  activeVersionId?: string;
  /** Skill status */
  status?: 'draft' | 'published' | 'archived';
} & Partial<StorageSkillSnapshotType>;

export type StorageListSkillsInput = {
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
   * Filter skills by author identifier.
   */
  authorId?: string;
  /**
   * Filter skills by metadata key-value pairs.
   * All specified key-value pairs must match (AND logic).
   */
  metadata?: Record<string, unknown>;
};

/** Paginated list output for thin skill records */
export type StorageListSkillsOutput = PaginationInfo & {
  skills: StorageSkillType[];
};

/** Paginated list output for resolved skills */
export type StorageListSkillsResolvedOutput = PaginationInfo & {
  skills: StorageResolvedSkillType[];
};

/**
 * Per-skill configuration stored in agent snapshots.
 * Allows overriding skill description and instructions for a specific agent context.
 */
export interface StorageSkillConfig {
  /** Custom description override for this skill in this agent context */
  description?: string;
  /** Custom instructions override for this skill in this agent context */
  instructions?: string;
  /** Pin to a specific version ID. Takes precedence over strategy. */
  pin?: string;
  /** Resolution strategy: 'latest' = latest published version, 'live' = read from filesystem */
  strategy?: 'latest' | 'live';
}

/**
 * A single entry in a skill version's file tree manifest.
 * Maps a file path to its content-addressable blob hash.
 */
export interface SkillVersionTreeEntry {
  /** SHA-256 hash of the file content (content-addressable key) */
  blobHash: string;
  /** File size in bytes */
  size: number;
  /** Optional MIME type */
  mimeType?: string;
  /**
   * Content encoding used in the blob store.
   * - 'utf-8' (default): content stored as UTF-8 text
   * - 'base64': content stored as base64-encoded string (for binary files like images)
   */
  encoding?: 'utf-8' | 'base64';
}

/**
 * Complete file tree manifest for a skill version.
 * Maps relative file paths to their blob entries.
 * This is stored as JSONB on the skill version row.
 *
 * Example:
 * {
 *   "SKILL.md": { blobHash: "abc123...", size: 1024, mimeType: "text/markdown" },
 *   "references/api.md": { blobHash: "def456...", size: 512, mimeType: "text/markdown" },
 *   "scripts/setup.sh": { blobHash: "ghi789...", size: 256, mimeType: "text/x-shellscript" }
 * }
 */
export interface SkillVersionTree {
  entries: Record<string, SkillVersionTreeEntry>;
}

/**
 * A stored blob entry in the content-addressable blob store.
 */
export interface StorageBlobEntry {
  /** SHA-256 hash of the content (primary key) */
  hash: string;
  /** The file content (text) */
  content: string;
  /** File size in bytes */
  size: number;
  /** Optional MIME type */
  mimeType?: string;
  /** When the blob was first stored */
  createdAt: Date;
}

/**
 * Workspace reference configuration stored in agent snapshots.
 * Can reference a stored workspace by ID or provide inline workspace config.
 */
export type StorageWorkspaceRef =
  | { type: 'id'; workspaceId: string }
  | { type: 'inline'; config: StorageWorkspaceSnapshotType };

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

// ============================================
// Dataset Types
// ============================================

export type TargetType = 'agent' | 'workflow' | 'scorer' | 'processor';

export interface DatasetRecord {
  id: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  groundTruthSchema?: Record<string, unknown>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetItem {
  id: string;
  datasetId: string;
  datasetVersion: number;
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetItemRow {
  id: string;
  datasetId: string;
  datasetVersion: number;
  validTo: number | null;
  isDeleted: boolean;
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  version: number;
  createdAt: Date;
}

// Dataset CRUD Input/Output Types

export interface CreateDatasetInput {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
}

export interface UpdateDatasetInput {
  id: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  inputSchema?: Record<string, unknown> | null;
  groundTruthSchema?: Record<string, unknown> | null;
}

export interface AddDatasetItemInput {
  datasetId: string;
  input: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
}

export interface UpdateDatasetItemInput {
  id: string;
  datasetId: string;
  input?: unknown;
  groundTruth?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ListDatasetsInput {
  pagination: StoragePagination;
}

export interface ListDatasetsOutput {
  datasets: DatasetRecord[];
  pagination: PaginationInfo;
}

export interface ListDatasetItemsInput {
  datasetId: string;
  version?: number;
  search?: string;
  pagination: StoragePagination;
}

export interface ListDatasetItemsOutput {
  items: DatasetItem[];
  pagination: PaginationInfo;
}

export interface ListDatasetVersionsInput {
  datasetId: string;
  pagination: StoragePagination;
}

export interface ListDatasetVersionsOutput {
  versions: DatasetVersion[];
  pagination: PaginationInfo;
}

export interface BatchInsertItemsInput {
  datasetId: string;
  items: Array<{
    input: unknown;
    groundTruth?: unknown;
    metadata?: Record<string, unknown>;
  }>;
}

export interface BatchDeleteItemsInput {
  datasetId: string;
  itemIds: string[];
}

// ============================================
// Experiment Types (Dataset Experiments)
// ============================================

export type ExperimentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Experiment {
  id: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  datasetId: string | null;
  datasetVersion: number | null;
  targetType: TargetType;
  targetId: string;
  status: ExperimentStatus;
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  itemId: string;
  itemDatasetVersion: number | null;
  input: unknown;
  output: unknown | null;
  groundTruth: unknown | null;
  error: { message: string; stack?: string; code?: string } | null;
  startedAt: Date;
  completedAt: Date;
  retryCount: number;
  traceId: string | null;
  createdAt: Date;
}

export interface CreateExperimentInput {
  id?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  datasetId: string | null;
  datasetVersion: number | null;
  targetType: TargetType;
  targetId: string;
  totalItems: number;
}

export interface UpdateExperimentInput {
  id: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status?: ExperimentStatus;
  succeededCount?: number;
  failedCount?: number;
  skippedCount?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AddExperimentResultInput {
  id?: string;
  experimentId: string;
  itemId: string;
  itemDatasetVersion: number | null;
  input: unknown;
  output: unknown | null;
  groundTruth: unknown | null;
  error: { message: string; stack?: string; code?: string } | null;
  startedAt: Date;
  completedAt: Date;
  retryCount: number;
  traceId?: string | null;
}

export interface ListExperimentsInput {
  datasetId?: string;
  pagination: StoragePagination;
}

export interface ListExperimentsOutput {
  experiments: Experiment[];
  pagination: PaginationInfo;
}

export interface ListExperimentResultsInput {
  experimentId: string;
  pagination: StoragePagination;
}

export interface ListExperimentResultsOutput {
  results: ExperimentResult[];
  pagination: PaginationInfo;
}
