import { MastraBase } from '../base';
import { MessageType, StorageThreadType } from '../memory';
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

  hasInit = false;

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

  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  async __getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    await this.init();
    return this.getThreadById({ threadId });
  }

  abstract getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]>;

  async __getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    await this.init();
    return this.getThreadsByResourceId({ resourceId });
  }

  abstract saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType>;

  async __saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    console.log('Saving thread:', thread);
    await this.init();
    return this.saveThread({ thread });
  }

  abstract updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType>;

  async __updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    await this.init();
    return this.updateThread({ id, title, metadata });
  }

  abstract deleteThread({ id }: { id: string }): Promise<void>;

  async __deleteThread({ threadId }: { threadId: string }): Promise<MessageType[]> {
    await this.init();
    return this.getMessages({ threadId });
  }

  abstract getMessages({ threadId }: { threadId: string }): Promise<MessageType[]>;

  async __getMessages({ threadId }: { threadId: string }): Promise<MessageType[]> {
    await this.init();
    return this.getMessages({ threadId });
  }

  abstract saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]>;

  async __saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    await this.init();
    return this.saveMessages({ messages });
  }

  async init(): Promise<void> {
    if (this.hasInit) {
      return;
    }

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
        meta: {
          type: 'text',
        },
        result: {
          type: 'text',
        },
        input: {
          type: 'text',
        },
        output: {
          type: 'text',
        },
        created_at: {
          type: 'timestamp',
        },
      },
    });

    await this.createTable({
      tableName: 'threads',
      schema: {
        id: { type: 'text', nullable: false, primaryKey: true },
        resourceId: { type: 'text', nullable: false },
        title: { type: 'text', nullable: false },
        metadata: { type: 'text', nullable: false },
        created_at: { type: 'timestamp', nullable: false },
        updated_at: { type: 'timestamp', nullable: false },
      },
    });

    await this.createTable({
      tableName: 'messages',
      schema: {
        id: { type: 'text', nullable: false, primaryKey: true },
        thread_id: { type: 'text', nullable: false },
        content: { type: 'text', nullable: false },
        created_at: { type: 'timestamp', nullable: false },
      },
    });

    this.hasInit = true;
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
    await this.init();

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
    if (!this.hasInit) {
      await this.init();
    }

    const d = await this.load<{ snapshot: WorkflowRunState }>({
      tableName: MastraStorage.TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    return d ? d.snapshot : null;
  }
}
