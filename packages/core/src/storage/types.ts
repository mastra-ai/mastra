import type { AISpanType } from '../ai-tracing';
import type { MetricResult, TestInfo } from '../eval';
import type { MemoryConfig } from '../memory/types';
import type { WorkflowRunState } from '../workflows';
import type { LegacyWorkflowRunState } from '../workflows/legacy';

export type StoragePagination = {
  page: number;
  perPage: number;
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

export interface LegacyWorkflowRuns {
  runs: LegacyWorkflowRun[];
  total: number;
}

export interface LegacyWorkflowRun {
  workflowId: string;
  runId: string;
  snapshot: LegacyWorkflowRunState | string;
  createdAt: Date;
  updatedAt: Date;
  resourceId?: string;
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
  workflowId: string;
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
  perPage: number;
  hasMore: boolean;
};

export type MastraMessageFormat = 'v1' | 'v2';

export type StorageGetMessagesArg = {
  threadId: string;
  resourceId?: string;
  selectBy?: {
    vectorSearchString?: string;
    last?: number | false;
    include?: {
      id: string;
      threadId?: string;
      withPreviousMessages?: number;
      withNextMessages?: number;
    }[];
    pagination?: PaginationArgs;
  };
  threadConfig?: MemoryConfig;
  format?: MastraMessageFormat;
};

export type StorageEvalRow = {
  input: string;
  output: string;
  result: Record<string, any>;
  agent_name: string;
  metric_name: string;
  instructions: string;
  test_info: Record<string, any> | null;
  global_run_id: string;
  run_id: string;
  created_at: Date;
};

export type EvalRow = {
  input: string;
  output: string;
  result: MetricResult;
  agentName: string;
  createdAt: string;
  metricName: string;
  instructions: string;
  runId: string;
  globalRunId: string;
  testInfo?: TestInfo;
};

export type StorageGetTracesArg = {
  name?: string;
  scope?: string;
  page: number;
  perPage: number;
  attributes?: Record<string, string>;
  filters?: Record<string, any>;
  fromDate?: Date;
  toDate?: Date;
};

export type StorageGetTracesPaginatedArg = {
  name?: string;
  scope?: string;
  attributes?: Record<string, string>;
  filters?: Record<string, any>;
} & PaginationArgs;

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

export interface ThreadSortOptions {
  orderBy?: ThreadOrderBy;
  sortDirection?: ThreadSortDirection;
}

export type ThreadOrderBy = 'createdAt' | 'updatedAt';

export type ThreadSortDirection = 'ASC' | 'DESC';

export interface AISpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  scope: Record<string, any> | null;
  spanType: AISpanType;
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

export type CreateAISpanRecord = Omit<AISpanRecord, 'createdAt' | 'updatedAt'>;
export type UpdateAISpanRecord = Omit<CreateAISpanRecord, 'spanId' | 'traceId'>;

export interface AITraceRecord {
  traceId: string;
  spans: AISpanRecord[];
}

export interface AITracesPaginatedArg {
  filters?: {
    name?: string;
    spanType?: AISpanType;
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
