import { DurableObjectNamespace, Request } from '@cloudflare/workers-types';
import { WorkflowRow } from '@mastra/core';
import { MastraStorage, WorkflowRunState, StorageColumn, ThreadType } from '@mastra/core';

export interface DurableObjectConfig {
  durableObjectId: DurableObjectId;
  durableObjectNamespace: DurableObjectNamespace;
}

export class DurableObjectStorage extends MastraStorage {
  private objectId: DurableObjectId;
  private objectNamespace: DurableObjectNamespace;

  constructor(config: DurableObjectConfig) {
    super('DURABLE_OBJECT');
    this.objectId = config.durableObjectId;
    this.objectNamespace = config.durableObjectNamespace;
  }

  private getKey(tableName: string, workflowName: string, runId: string): string {
    return `${tableName}:${workflowName}:${runId}`;
  }

  // @ts-expect-error keep the signature alive
  protected async createTable(tableName: string, schema: Record<string, StorageColumn>): Promise<void> {
    // No need to create tables for Durable Objects
  }

  async clearTable(tableName: string): Promise<void> {
    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/clear/${tableName}`, {
        method: 'DELETE',
      }),
    );

    if (!stub.ok) {
      throw new Error(`Failed to clear table: ${await stub.text()}`);
    }
  }

  protected async insert(tableName: typeof MastraStorage.TABLE_WORKFLOWS, record: WorkflowRow): Promise<void>;
  protected async insert(tableName: string, record: Record<string, any>): Promise<void> {
    let payload: Record<string, any> | null = null;
    if (tableName === 'workflows') {
      payload = {
        workflow_name: record.workflowName,
        run_id: record.runId,
        snapshot: record.snapshot,
        _metadata: {
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        },
      };
    }

    if (!payload) {
      throw new Error('Invalid payload');
    }

    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/snapshot/${key}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    );

    if (!stub.ok) {
      throw new Error(`Failed to persist snapshot: ${await stub.text()}`);
    }
  }

  protected async load(
    tableName: typeof MastraStorage.TABLE_WORKFLOWS,
    keys: { workflow_name: string; run_id: string },
  ): Promise<WorkflowRow>;
  protected async load(tableName: string, keys: Record<string, string>): Promise<WorkflowRow | null> {
    if (tableName !== MastraStorage.TABLE_WORKFLOWS) {
      return null;
    }

    if (keys.workflow_name && keys.run_id) {
      const key = this.getKey(tableName, keys.workflow_name, keys.run_id);
      const obj = this.objectNamespace.get(this.objectId);
      const stub = await obj.fetch(
        new Request(`https://dummy/snapshot/${key}`, {
          method: 'GET',
        }),
      );

      if (!stub.ok) {
        if (stub.status === 404) {
          return null;
        }
        throw new Error(`Failed to load snapshot: ${await stub.text()}`);
      }

      const data = (await stub.json()) as { _metadata: unknown } & WorkflowRunState;
      // Remove metadata before returning
      const { _metadata, ...snapshot } = data;
      return snapshot as WorkflowRunState;
    } else {
      console.error('Workflow name or run ID is undefined');
      return null;
    }
  }

  async getThreadById(_params: { threadId: string }): Promise<ThreadType | null> {
    throw new Error('not implemented yet');
  }

  async getThreadsByResourceId(_params: { resourceid: string }): Promise<ThreadType[]> {
    throw new Error('not implemented yet');
  }

  async saveThread(_params: { thread: ThreadType }): Promise<ThreadType> {
    throw new Error('not implemented yet');
  }

  async updateThread(_id: string, _title: string, _metadata: Record<string, unknown>): Promise<ThreadType> {
    throw new Error('not implemented yet');
  }

  async deleteThread(_id: string): Promise<void> {
    throw new Error('not implemented yet');
  }

  async getMessages<T = unknown>(_params: { threadId: string }): Promise<T> {
    throw new Error('not implemented yet');
  }

  async saveMessages(_params: { messages: MessageType[] }): Promise<MessageType[]> {
    throw new Error('not implemented yet');
  }

  async close(): Promise<void> {
    // No cleanup needed for Durable Objects
  }
}
