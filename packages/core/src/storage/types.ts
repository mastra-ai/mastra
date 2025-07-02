import type { MetricResult, TestInfo } from '../eval';
import type { MemoryConfig } from '../memory/types';
import type { WorkflowRunState } from '../workflows';
import type { LegacyWorkflowRunState } from '../workflows/legacy';

export interface StorageColumn {
  type: 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer' | 'bigint';
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
  format?: 'v1' | 'v2';
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
