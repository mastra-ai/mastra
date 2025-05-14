import type { MetricResult, TestInfo } from '../eval';
import type { MemoryConfig } from '../memory/types';
import type { WorkflowRunState } from '../workflows';
import type { VNextWorkflowRunState } from '../workflows/vNext';

export interface StorageColumn {
  type: 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer' | 'bigint';
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

export interface WorkflowRun {
  workflowName: string;
  runId: string;
  snapshot: WorkflowRunState | string;
  createdAt: Date;
  updatedAt: Date;
  resourceId?: string;
}

export interface VNextWorkflowRuns {
  runs: VNextWorkflowRun[];
  total: number;
}

export interface VNextWorkflowRun {
  workflowName: string;
  runId: string;
  snapshot: VNextWorkflowRunState | string;
  createdAt: Date;
  updatedAt: Date;
  resourceId?: string;
}

export type StorageGetMessagesArg = {
  threadId: string;
  resourceId?: string;
  selectBy?: {
    vectorSearchString?: string;
    last?: number | false;
    include?: {
      id: string;
      withPreviousMessages?: number;
      withNextMessages?: number;
    }[];
  };
  threadConfig?: MemoryConfig;
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
