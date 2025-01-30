import { MastraBase } from '../base';
import { MessageType, ThreadType } from '../memory';
import { WorkflowRunState } from '../workflows';

import { StorageColumn, StorageGetMessagesArg } from './types';

export type TABLE_NAMES = typeof MastraStorageBase.TABLE_WORKFLOWS | typeof MastraStorageBase.TABLE_EVALS;

export abstract class MastraStorageBase extends MastraBase {
  static readonly TABLE_WORKFLOWS = 'workflows';
  static readonly TABLE_EVALS = 'evals';

  // In-memory storage
  private tables: Map<TABLE_NAMES, Map<string, any>>;
  private threads: Map<string, ThreadType>;
  private messages: Map<string, MessageType[]>;

  constructor({ name }: { name: string }) {
    super({
      component: 'STORAGE',
      name,
    });
    // Initialize in-memory storage
    this.tables = new Map();
    this.threads = new Map();
    this.messages = new Map();
  }

  protected async createTable({
    tableName,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
  }

  protected async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.tables.get(tableName)?.clear();
  }

  protected async insert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    record: Record<string, any>;
  }): Promise<void> {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    if (tableName === MastraStorageBase.TABLE_WORKFLOWS) {
      const key = `${record.workflow_name}:${record.run_id}`;
      table.set(key, record);
    } else {
      const key = record.global_run_id || record.id;
      table.set(key, record);
    }
  }

  protected async load<R>({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    if (tableName === MastraStorageBase.TABLE_WORKFLOWS) {
      const key = `${keys.workflow_name}:${keys.run_id}`;
      return (table.get(key) as R) || null;
    }

    const firstKey = Object.values(keys)[0];
    return (table.get(firstKey!) as R) || null;
  }

  async init(): Promise<void> {
    await this.createTable({
      tableName: 'workflows',
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
      tableName: MastraStorageBase.TABLE_WORKFLOWS,
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
      tableName: MastraStorageBase.TABLE_WORKFLOWS,
      keys: { workflow_name: workflowName, run_id: runId },
    });
    return d ? d.snapshot : null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    return this.threads.get(threadId) || null;
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<ThreadType[]> {
    return Array.from(this.threads.values()).filter(thread => thread.resourceId === resourceId);
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    this.threads.set(thread.id, thread);
    return thread;
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<ThreadType> {
    const thread = this.threads.get(id);
    if (!thread) {
      throw new Error(`Thread ${id} not found`);
    }

    const updatedThread = {
      ...thread,
      title,
      metadata: {
        ...thread.metadata,
        ...metadata,
      },
    };
    this.threads.set(id, updatedThread);
    return updatedThread;
  }

  async deleteThread({ id }: { id: string }): Promise<void> {
    this.threads.delete(id);
    this.messages.delete(id);
  }

  async getMessages<T = unknown>({ threadId }: StorageGetMessagesArg): Promise<T> {
    return (this.messages.get(threadId) || []) as T;
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (messages.length === 0) return messages;

    const threadId = messages?.[0]?.threadId;

    if (!threadId) {
      throw new Error('Thread ID is required');
    }

    const existingMessages = this.messages.get(threadId) || [];

    const updatedMessages = [...existingMessages, ...messages];

    this.messages.set(threadId, updatedMessages);
    return messages;
  }
}
