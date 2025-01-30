import { WorkflowRunState } from '../workflows';

export interface StorageColumn {
  type: 'text' | 'timestamp' | 'uuid' | 'jsonb' | 'integer';
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
