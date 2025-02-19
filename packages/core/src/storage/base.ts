import { MastraBase } from '../base';
import type { MessageType, StorageThreadType } from '../memory/types';
import type { WorkflowRunState } from '../workflows';

import { TABLE_WORKFLOW_SNAPSHOT, TABLE_EVALS, TABLE_MESSAGES, TABLE_THREADS, TABLE_TRACES } from './constants';
import type { TABLE_NAMES } from './constants';
import type { EvalRow, StorageColumn, StorageGetMessagesArg } from './types';

export abstract class MastraStorage extends MastraBase {
  /** @deprecated import from { TABLE_WORKFLOW_SNAPSHOT } '@mastra/core/storage' instead */
  static readonly TABLE_WORKFLOW_SNAPSHOT = TABLE_WORKFLOW_SNAPSHOT;
  /** @deprecated import from { TABLE_EVALS } '@mastra/core/storage' instead */
  static readonly TABLE_EVALS = TABLE_EVALS;
  /** @deprecated import from { TABLE_MESSAGES } '@mastra/core/storage' instead */
  static readonly TABLE_MESSAGES = TABLE_MESSAGES;
  /** @deprecated import from { TABLE_THREADS } '@mastra/core/storage' instead */
  static readonly TABLE_THREADS = TABLE_THREADS;
  /** @deprecated import { TABLE_TRACES } from '@mastra/core/storage' instead */
  static readonly TABLE_TRACES = TABLE_TRACES;

  protected hasInitialized: null | Promise<boolean> = null;

  constructor({ name }: { name: string }) {
    super({
      component: 'STORAGE',
      name,
    });
  }

  abstract createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void>;

  abstract clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void>;

  abstract batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void>;

  async __batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    await this.init();
    return this.batchInsert({ tableName, records });
  }

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

  abstract deleteThread({ threadId }: { threadId: string }): Promise<void>;

  async __deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.init();
    return this.deleteThread({ threadId });
  }

  abstract getMessages({ threadId, selectBy, threadConfig }: StorageGetMessagesArg): Promise<MessageType[]>;

  async __getMessages({ threadId, selectBy, threadConfig }: StorageGetMessagesArg): Promise<MessageType[]> {
    await this.init();
    return this.getMessages({ threadId, selectBy, threadConfig });
  }

  abstract saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]>;

  async __saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    await this.init();
    return this.saveMessages({ messages });
  }

  abstract getTraces({
    name,
    scope,
    page,
    perPage,
    attributes,
  }: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]>;

  async __getTraces({
    scope,
    page,
    perPage,
    attributes,
  }: {
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    await this.init();
    return this.getTraces({ scope, page, perPage, attributes });
  }

  async init(): Promise<void> {
    // to prevent race conditions, await any current init
    if (await this.hasInitialized) {
      return;
    }

    this.hasInitialized = Promise.all([
      this.createTable({
        tableName: TABLE_WORKFLOW_SNAPSHOT,
        schema: {
          workflow_name: {
            type: 'text',
          },
          run_id: {
            type: 'text',
          },
          snapshot: {
            type: 'text',
          },
          createdAt: {
            type: 'timestamp',
          },
          updatedAt: {
            type: 'timestamp',
          },
        },
      }),

      this.createTable({
        tableName: TABLE_EVALS,
        schema: {
          input: {
            type: 'text',
          },
          output: {
            type: 'text',
          },
          result: {
            type: 'jsonb',
          },
          agent_name: {
            type: 'text',
          },
          metric_name: {
            type: 'text',
          },
          instructions: {
            type: 'text',
          },
          test_info: {
            type: 'jsonb',
            nullable: true,
          },
          global_run_id: {
            type: 'text',
          },
          run_id: {
            type: 'text',
          },
          created_at: {
            type: 'timestamp',
          },
        },
      }),

      this.createTable({
        tableName: TABLE_THREADS,
        schema: {
          id: { type: 'text', nullable: false, primaryKey: true },
          resourceId: { type: 'text', nullable: false },
          title: { type: 'text', nullable: false },
          metadata: { type: 'text', nullable: true },
          createdAt: { type: 'timestamp', nullable: false },
          updatedAt: { type: 'timestamp', nullable: false },
        },
      }),

      this.createTable({
        tableName: TABLE_MESSAGES,
        schema: {
          id: { type: 'text', nullable: false, primaryKey: true },
          thread_id: { type: 'text', nullable: false },
          content: { type: 'text', nullable: false },
          role: { type: 'text', nullable: false },
          type: { type: 'text', nullable: false },
          createdAt: { type: 'timestamp', nullable: false },
        },
      }),

      this.createTable({
        tableName: TABLE_TRACES,
        schema: {
          id: { type: 'text', nullable: false, primaryKey: true },
          parentSpanId: { type: 'text', nullable: true },
          name: { type: 'text', nullable: false },
          traceId: { type: 'text', nullable: false },
          scope: { type: 'text', nullable: false },
          kind: { type: 'integer', nullable: false },
          attributes: { type: 'jsonb', nullable: true },
          status: { type: 'jsonb', nullable: true },
          events: { type: 'jsonb', nullable: true },
          links: { type: 'jsonb', nullable: true },
          other: { type: 'text', nullable: true },
          startTime: { type: 'bigint', nullable: false },
          endTime: { type: 'bigint', nullable: false },
          createdAt: { type: 'timestamp', nullable: false },
        },
      }),
    ]).then(() => true);

    await this.hasInitialized;
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.logger.debug('Persisting workflow snapshot', { workflowName, runId, data });
    await this.insert({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
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
    if (!this.hasInitialized) {
      await this.init();
    }
    this.logger.debug('Loading workflow snapshot', { workflowName, runId });
    const d = await this.load<{ snapshot: WorkflowRunState }>({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      keys: { workflow_name: workflowName, run_id: runId },
    });

    return d ? d.snapshot : null;
  }

  abstract getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]>;

  async __getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    await this.init();
    return this.getEvalsByAgentName(agentName, type);
  }
}
