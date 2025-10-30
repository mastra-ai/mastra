import type { AISpanType } from '../ai-tracing';
import type { MemoryConfig, MastraMessageV2, StorageThreadType } from '../memory/types';
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
  workflowName: string;
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
  perPage: number;
  hasMore: boolean;
};

export type MastraMessageFormat = 'v1' | 'v2';

export type StorageListMessagesInput = {
  threadId: string;
  resourceId?: string;
  include?: {
    id: string;
    threadId?: string;
    withPreviousMessages?: number;
    withNextMessages?: number;
  }[];
  limit?: number | false;
  offset?: number;
  filter?: {
    dateRange?: {
      start?: Date;
      end?: Date;
    };
  };
  orderBy?: {
    field: 'createdAt';
    direction: 'ASC' | 'DESC';
  };
};

export type StorageListMessagesOutput = PaginationInfo & {
  messages: MastraMessageV2[];
};

export type StorageListWorkflowRunsInput = {
  workflowName?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
  resourceId?: string;
};

export type StorageListThreadsByResourceIdPaginatedInput = {
  resourceId: string;
  limit: number;
  offset: number;
} & ThreadSortOptions;

export type StorageListThreadsByResourceIdPaginatedOutput = PaginationInfo & {
  threads: StorageThreadType[];
};

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
