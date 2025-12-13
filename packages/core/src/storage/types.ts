import { z } from 'zod';
import type { SerializedError } from '../error';
import type { MastraDBMessage, StorageThreadType } from '../memory/types';
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

function unwrapSchema(schema: z.ZodTypeAny): { base: z.ZodTypeAny; nullable: boolean } {
  let current = schema;
  let nullable = false;

  while (true) {
    if (current instanceof z.ZodNullable) {
      nullable = true;
      current = current._def.innerType;
      continue;
    }

    if (current instanceof z.ZodOptional) {
      // For DB purposes, we usually treat "optional" as "nullable"
      nullable = true;
      current = current._def.innerType;
      continue;
    }

    if (current instanceof z.ZodDefault) {
      current = current._def.innerType;
      continue;
    }

    if (current instanceof z.ZodEffects) {
      current = current._def.schema;
      continue;
    }

    if (current instanceof z.ZodBranded) {
      current = current._def.type;
      continue;
    }

    // If you ever use ZodCatch/ZodPipeline, you can unwrap them here too.
    break;
  }

  return { base: current, nullable };
}

function zodToStorageType(schema: z.ZodTypeAny): StorageColumnType {
  if (schema instanceof z.ZodString || schema instanceof z.ZodNativeEnum) {
    return 'text';
  }
  if (schema instanceof z.ZodDate) {
    return 'timestamp';
  }
  if (schema instanceof z.ZodBoolean) {
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
