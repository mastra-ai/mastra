import type { z } from 'zod';
import type { AgentExecutionOptionsBase } from '../agent/agent.types';
import type { SerializedError } from '../error';
import type { ScoringSamplingConfig } from '../evals/types';
import type { MastraDBMessage, StorageThreadType, SerializedMemoryConfig } from '../memory/types';
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
  /** System instructions/prompt */
  instructions: string;
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
} & Partial<StorageAgentSnapshotType>;

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
   * Ratio controlling how much context to retain after activation (0-1 float).
   * `1 - activationRatio` is the fraction of the threshold to keep as raw messages.
   * Target tokens to remove = `currentPendingTokens - messageTokensThreshold * (1 - activationRatio)`.
   * Chunks are selected by boundary, biased under the target.
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
