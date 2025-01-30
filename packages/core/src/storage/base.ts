import { MastraBase } from '../base';
import { MessageType, ThreadType } from '../memory';
import { WorkflowRunState } from '../workflows';

import { StorageColumn } from './types';

export type TABLE_NAMES =
  | typeof MastraStorage.TABLE_WORKFLOW_SNAPSHOT
  | typeof MastraStorage.TABLE_EVALS
  | typeof MastraStorage.TABLE_MESSAGES
  | typeof MastraStorage.TABLE_THREADS;

export abstract class MastraStorage extends MastraBase {
  static readonly TABLE_WORKFLOW_SNAPSHOT = 'workflow_snapshot';
  static readonly TABLE_EVALS = 'evals';
  static readonly TABLE_MESSAGES = 'messages';
  static readonly TABLE_THREADS = 'threads';

  constructor({ name }: { name: string }) {
    super({
      component: 'STORAGE',
      name,
    });
  }

  abstract createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void>;

  abstract clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void>;

  abstract load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null>;

  abstract getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null>;

  abstract getThreadsByResourceId({ resource_id }: { resource_id: string }): Promise<ThreadType[]>;

  abstract saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType>;

  abstract updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<ThreadType>;

  abstract deleteThread({ id }: { id: string }): Promise<void>;

  abstract getMessages({ threadId }: { threadId: string }): Promise<MessageType[]>;

  abstract saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]>;

  async init(): Promise<void> {
    await this.createTable({
      tableName: 'workflow_snapshot',
      schema: {
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
      },
    });

    await this.createTable({
      tableName: 'evals',
      schema: {
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
      },
    });
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const data = {
      workflow_name: workflowName,
      run_id: runId,
      snapshot,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await this.insert({
      tableName: MastraStorage.TABLE_WORKFLOW_SNAPSHOT,
      record: data,
    });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const d = await this.load<{ snapshot: WorkflowRunState }>({
      tableName: MastraStorage.TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });
    return d ? d.snapshot : null;
  }
}
