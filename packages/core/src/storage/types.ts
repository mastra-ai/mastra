import type { MastraDBMessage, StorageThreadType } from '../memory/types';
import type { SpanType } from '../observability';
import type { WorkflowRunState, WorkflowRunStatus } from '../workflows';

export type StoragePagination = {
  page: number;
  perPage: number | false;
};

export interface StorageColumn {
  type: 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer' | 'float' | 'bigint' | 'boolean';
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

export type PaginationArgs = {
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  page?: number;
  perPage?: number;
};

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
    };
  };
  orderBy?: StorageOrderBy;
};

/**
 * Input for listing messages - requires either threadId OR resourceId.
 * This is a discriminated union to ensure at least one is provided.
 */
export type StorageListMessagesInput =
  | (StorageListMessagesOptions & {
      /**
       * Thread ID(s) to query messages from.
       */
      threadId: string | string[];
      /**
       * Optional resource ID to further filter messages.
       */
      resourceId?: string;
    })
  | (StorageListMessagesOptions & {
      /**
       * When querying by resourceId only, threadId must be undefined.
       */
      threadId?: undefined;
      /**
       * Resource ID to query ALL messages for the resource across all threads.
       */
      resourceId: string;
    });

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

export interface StorageOrderBy {
  field?: ThreadOrderBy;
  direction?: ThreadSortDirection;
}

export interface ThreadSortOptions {
  orderBy?: ThreadOrderBy;
  sortDirection?: ThreadSortDirection;
}

export type ThreadOrderBy = 'createdAt' | 'updatedAt';

export type ThreadSortDirection = 'ASC' | 'DESC';

export interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  scope: Record<string, any> | null;
  spanType: SpanType;
  attributes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  links: any;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  input: any;
  output: any;
  error: any;
  isEvent: boolean;
}

export type CreateSpanRecord = Omit<SpanRecord, 'createdAt' | 'updatedAt'>;
export type UpdateSpanRecord = Omit<CreateSpanRecord, 'spanId' | 'traceId'>;

export interface TraceRecord {
  traceId: string;
  spans: SpanRecord[];
}

export interface TracesPaginatedArg {
  filters?: {
    name?: string;
    spanType?: SpanType;
    entityId?: string;
    entityType?: 'agent' | 'workflow';
  };
  pagination?: PaginationArgs;
}

// Basic Index Management Types
export interface CreateIndexOptions {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  concurrent?: boolean;
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

  // Note: Message tracking via IDs has been removed in favor of cursor-based
  // tracking via lastObservedAt. This is more efficient for long conversations.

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
