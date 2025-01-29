import { MastraBase } from '../base';
import { MessageType, ThreadType } from '../memory';
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
  };
};

export type TABLE_NAMES = typeof MastraStorage.TABLE_WORKFLOWS | typeof MastraStorage.TABLE_EVALS;

export abstract class MastraStorage extends MastraBase {
  static readonly TABLE_WORKFLOWS = 'workflows';
  static readonly TABLE_EVALS = 'evals';

  constructor(name: string) {
    super({
      component: 'STORAGE',
      name,
    });
  }

  protected abstract createTable(tableName: TABLE_NAMES, schema: Record<string, StorageColumn>): Promise<void>;
  protected abstract clearTable(tableName: TABLE_NAMES): Promise<void>;

  protected abstract insert(tableName: typeof MastraStorage.TABLE_WORKFLOWS, record: WorkflowRow): Promise<void>;
  protected abstract insert(tableName: TABLE_NAMES, record: Record<string, any>): Promise<void>;

  protected abstract load<R extends WorkflowRunState>(
    tableName: typeof MastraStorage.TABLE_WORKFLOWS,
    keys: { workflow_name: string; run_id: string },
  ): Promise<R>;
  protected abstract load<R>(tableName: TABLE_NAMES, keys: Record<string, string>): Promise<R | null>;

  async init(): Promise<void> {
    await this.createTable('workflows', {
      workflow_name: {
        type: 'text',
        primaryKey: true,
      },
      run_id: {
        type: 'text',
        primaryKey: true,
      },
      snapshot: {
        type: 'text',
        primaryKey: true,
      },
      created_at: {
        type: 'timestamp',
      },
      updated_at: {
        type: 'timestamp',
      },
    });

    await this.createTable('evals', {
      global_run_id: {
        type: 'text',
        primaryKey: true,
      },
      run_id: {
        type: 'text',
        primaryKey: true,
      },
      input: {
        type: 'text',
      },
      output: {
        type: 'text',
      },
      agent_name: {
        type: 'text',
      },
      metric_name: {
        type: 'text',
      },
      test_name: {
        type: 'text',
        nullable: true,
      },
      test_path: {
        type: 'text',
        nullable: true,
      },
      created_at: {
        type: 'timestamp',
      },
    });
  }

  async persistWorkflowSnapshot(params: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { workflowName, runId, snapshot } = params;
    const data = {
      workflow_name: workflowName,
      run_id: runId,
      snapshot,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.insert(MastraStorage.TABLE_WORKFLOWS, data);
  }

  async loadWorkflowSnapshot(params: { workflowName: string; runId: string }): Promise<WorkflowRunState | null> {
    const { workflowName, runId } = params;

    const data = await this.load(MastraStorage.TABLE_WORKFLOWS, { workflow_name: workflowName, run_id: runId });

    return data;
  }

  // Memory Methods

  abstract getThreadById(params: { threadId: string }): Promise<ThreadType | null>;
  abstract getThreadsByResourceId(params: { resourceid: string }): Promise<ThreadType[]>;
  abstract saveThread(params: { thread: ThreadType }): Promise<ThreadType>;
  abstract updateThread(id: string, title: string, metadata: Record<string, unknown>): Promise<ThreadType>;
  abstract deleteThread(id: string): Promise<void>;
  abstract getMessages<T = unknown>(params: StorageGetMessagesArg): Promise<T>;
  abstract saveMessages(params: { messages: MessageType[] }): Promise<MessageType[]>;
}
