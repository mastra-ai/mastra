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

export type SpanEntityType = 'agent' | 'workflow' | 'tool' | 'network' | 'step';

// Derived status helpers (status is computed from error/endedAt, not stored)
export type SpanStatus = 'success' | 'error' | 'running';
export function getSpanStatus(span: { error: any; endedAt: Date | null }): SpanStatus {
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
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  scope: Record<string, any> | null; // Mastra package versions {"core": "1.0.0", "memory": "1.0.0"}
  spanType: SpanType;

  // Entity identification - first-class fields for filtering
  entityType: SpanEntityType | null;
  entityId: string | null;
  entityName: string | null;

  // Tags for flexible categorization
  tags: string[] | null;

  // Identity & Tenancy
  userId: string | null;
  organizationId: string | null;
  resourceId: string | null; // Broader resource context (Mastra memory compatibility)

  // Correlation IDs
  runId: string | null;
  sessionId: string | null;
  threadId: string | null;
  requestId: string | null;

  // Deployment context
  environment: string | null; // 'production' | 'staging' | 'development'
  source: string | null; // 'local' | 'cloud' | 'ci'
  serviceName: string | null;
  deploymentId: string | null;
  versionInfo: VersionInfo | null;

  // Span data
  attributes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  links: any;
  input: any;
  output: any;
  error: any; // Presence indicates failure (status derived from this)

  // Timestamps
  startedAt: Date;
  endedAt: Date | null; // null = running (status derived from this)
  createdAt: Date;
  updatedAt: Date | null;

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
    // Span type filter
    spanType?: SpanType;

    // Entity filters
    entityType?: SpanEntityType;
    entityId?: string;
    entityName?: string;

    // Status filter (derived: 'error' = has error, 'running' = no endedAt, 'success' = endedAt and no error)
    status?: SpanStatus;

    // Tag filter (match any of these tags)
    tags?: string[];

    // Identity & Tenancy filters
    userId?: string;
    organizationId?: string;
    resourceId?: string;

    // Correlation ID filters
    runId?: string;
    sessionId?: string;
    threadId?: string;
    requestId?: string;

    // Deployment context filters
    environment?: string;
    source?: string;
    serviceName?: string;
    deploymentId?: string;

    // JSONB filters (key-value matching)
    metadata?: Record<string, unknown>;
    scope?: Record<string, unknown>;
    versionInfo?: Record<string, unknown>;
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
