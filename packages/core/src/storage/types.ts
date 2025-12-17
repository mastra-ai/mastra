import type { SerializedError } from '../error';
import type { MastraDBMessage, StorageThreadType } from '../memory/types';
import type { SpanType } from '../observability';
import type { StepResult, WorkflowRunState, WorkflowRunStatus } from '../workflows';

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
  /** Input processor configurations */
  inputProcessors?: Record<string, unknown>[];
  /** Output processor configurations */
  outputProcessors?: Record<string, unknown>[];
  /** Memory key to resolve from Mastra's memory registry */
  memory?: string;
  /** Scorer keys with optional sampling config, to resolve from Mastra's scorer registry */
  scorers?: Record<string, StorageScorerConfig>;
  /** Additional metadata for the agent */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
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
  inputProcessors?: Record<string, unknown>[];
  outputProcessors?: Record<string, unknown>[];
  /** Memory key to resolve from Mastra's memory registry */
  memory?: string;
  /** Scorer keys with optional sampling config */
  scorers?: Record<string, StorageScorerConfig>;
  metadata?: Record<string, unknown>;
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
};

export type StorageListAgentsOutput = PaginationInfo & {
  agents: StorageAgentType[];
};

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

// Workflow Storage Types

export interface UpdateWorkflowStateOptions {
  status: WorkflowRunStatus;
  result?: StepResult<any, any, any, any>;
  error?: SerializedError;
  suspendedPaths?: Record<string, number[]>;
  waitingPaths?: Record<string, number[]>;
}
