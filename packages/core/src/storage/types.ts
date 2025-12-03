import type { MastraDBMessage, StorageThreadType } from '../memory/types';
import type { SpanType } from '../observability';
import type { WorkflowRunState, WorkflowRunStatus } from '../workflows';

// Import types from schemas for use in this file
import type { SpanEntityType, PaginationArgs } from './schemas/observability';

// Re-export observability schema types for backwards compatibility
export type {
  SpanEntityType,
  SpanStatus,
  DateRange,
  PaginationArgs,
  TracesFilter,
  TracesPaginatedArg,
} from './schemas/observability';

// Re-export schemas for validation
export {
  spanEntityTypeSchema,
  spanStatusSchema,
  spanTypeSchema,
  dateRangeSchema,
  paginationArgsSchema,
  tracesFilterSchema,
  tracesPaginatedArgSchema,
  // Query param translation functions
  parseTracesQueryParams,
  serializeTracesParams,
} from './schemas/observability';

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
  orderBy?: StorageOrderBy;
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

// Derived status helper (status is computed from error/endedAt, not stored)
export function getSpanStatus(span: { error: any; endedAt: Date | null }): 'success' | 'error' | 'running' {
  if (span.error) return 'error';
  if (span.endedAt === null) return 'running';
  return 'success';
}

export interface VersionInfo {
  app?: string;
  gitSha?: string;
  branch?: string;
  buildId?: string;
  [key: string]: string | undefined;
}

export interface SpanRecord {
  traceId: string; // Unique trace identifier
  spanId: string; // Unique span identifier within the trace
  parentSpanId: string | null; // Parent span reference (null = root span)
  name: string; // Human-readable span name
  scope: Record<string, any> | null; // Mastra package versions {"core": "1.0.0", "memory": "1.0.0"}
  spanType: SpanType; // WORKFLOW_RUN, AGENT_RUN, TOOL_CALL, etc.

  // Entity identification - first-class fields for filtering
  entityType: SpanEntityType | null; // 'agent' | 'workflow' | 'tool' | 'network' | 'step'
  entityId: string | null; // ID/name of the entity (e.g., 'weatherAgent', 'orderWorkflow')
  entityName: string | null; // Human-readable display name

  // Identity & Tenancy
  userId: string | null; // Human end-user who triggered the trace
  organizationId: string | null; // Multi-tenant organization/account
  resourceId: string | null; // Broader resource context (Mastra memory compatibility)

  // Correlation IDs
  runId: string | null; // Unique execution run identifier
  sessionId: string | null; // Session identifier for grouping traces
  threadId: string | null; // Conversation thread identifier
  requestId: string | null; // HTTP request ID for log correlation

  // Deployment context
  environment: string | null; // 'production' | 'staging' | 'development'
  source: string | null; // 'local' | 'cloud' | 'ci'
  serviceName: string | null; // Name of the service
  deploymentId: string | null; // Specific deployment/release identifier
  versionInfo: VersionInfo | null; // App version info {"app": "1.0.0", "gitSha": "abc123"}

  // Span data
  attributes: Record<string, any> | null; // Span-type specific attributes (e.g., model, tokens, tools)
  metadata: Record<string, any> | null; // User-defined metadata for custom filtering
  tags: string[] | null; // Labels for filtering traces
  links: any; // References to related spans in other traces
  input: any; // Input data passed to the span
  output: any; // Output data returned from the span
  error: any; // Error info - presence indicates failure (status derived from this)

  // Timestamps
  startedAt: Date; // When the span started
  endedAt: Date | null; // When the span ended (null = running, status derived from this)
  createdAt: Date; // Database record creation time
  updatedAt: Date | null; // Database record last update time

  isEvent: boolean; // Whether this is an event (point-in-time) vs a span (duration)
}

export type CreateSpanRecord = Omit<SpanRecord, 'createdAt' | 'updatedAt'>;
export type UpdateSpanRecord = Omit<CreateSpanRecord, 'spanId' | 'traceId'>;

export interface TraceRecord {
  traceId: string;
  spans: SpanRecord[];
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
