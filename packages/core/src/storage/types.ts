import { MemoryConfig } from '../memory';
import { WorkflowRunState } from '../workflows';

export interface StorageColumn {
  type: 'text' | 'timestamp';
  primaryKey?: boolean;
  nullable?: boolean;
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
