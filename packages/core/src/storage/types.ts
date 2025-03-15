import type { MetricResult } from '../eval/metric';
import type { TestInfo } from '../eval/types';
import type { MemoryConfig } from '../memory/types';
import type { WorkflowRunState } from '../workflows/types';

export interface StorageColumn {
  type: 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer' | 'bigint';
  primaryKey?: boolean;
  nullable?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface WorkflowRow {
  workflow_name: string;
  run_id: string;
  snapshot: WorkflowRunState;
  created_at: Date;
  updated_at: Date;
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

export interface LibSQLConfig {
  url: string;
  authToken?: string;
}
