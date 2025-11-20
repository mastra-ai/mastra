import { MastraBase } from '../../../base';
import type { StepResult, WorkflowRunState } from '../../../workflows';
import type { TABLE_WORKFLOW_SNAPSHOT } from '../../constants';
import type {
  WorkflowRun,
  WorkflowRuns,
  StorageListWorkflowRunsInput,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '../../types';

export abstract class WorkflowsStorageBase extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract init(): Promise<void>;

  abstract updateWorkflowResults({
    workflowId,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowId: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
    workflowId,
    runId,
    opts,
  }: {
    workflowId: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined>;

  abstract createWorkflowSnapshot(_: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void>;

  abstract getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null>;

  abstract listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowId?: string }): Promise<WorkflowRun | null>;

  abstract dropData(): Promise<void>;

  async createIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index creation
  }

  async dropIndexes(): Promise<void> {
    // Optional: subclasses can override this method to implement index dropping
  }

  async createIndex<T extends typeof TABLE_WORKFLOW_SNAPSHOT>({
    name: _name,
    table: _table,
    columns: _columns,
  }: {
    table: T;
  } & Omit<CreateIndexOptions, 'table'>): Promise<void> {
    // Optional: subclasses can override this method to implement index creation
  }

  async listIndexes<T extends typeof TABLE_WORKFLOW_SNAPSHOT>(_table: T): Promise<IndexInfo[]> {
    // Optional: subclasses can override this method to implement index listing
    return [];
  }

  async describeIndex(_name: string): Promise<StorageIndexStats> {
    // Optional: subclasses can override this method to implement index description
    throw new Error(
      `Index description is not supported by this storage adapter (${this.constructor.name}). ` +
        `The describeIndex method needs to be implemented in the storage adapter.`,
    );
  }

  async dropIndex(_name: string): Promise<void> {
    // Optional: subclasses can override this method to implement index dropping
  }
}
