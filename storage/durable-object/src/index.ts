import { DurableObjectNamespace, Request } from '@cloudflare/workers-types';
import { MastraStorage, WorkflowRunState } from '@mastra/core';

export interface DurableObjectConfig {
  durableObjectId: DurableObjectId;
  durableObjectNamespace: DurableObjectNamespace;
}

export class DurableObjectStorage extends MastraStorage {
  private objectId: DurableObjectId;
  private objectNamespace: DurableObjectNamespace;

  constructor(config: DurableObjectConfig) {
    super();
    this.objectId = config.durableObjectId;
    this.objectNamespace = config.durableObjectNamespace;
  }

  private getKey(tableName: string, workflowName: string, runId: string): string {
    return `${tableName}:${workflowName}:${runId}`;
  }

  async init(_tableName: string): Promise<void> {
    // No initialization needed for Durable Objects
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

  async persistWorkflowSnapshot(params: {
    tableName: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { tableName, workflowName, runId, snapshot } = params;
    const key = this.getKey(tableName, workflowName, runId);

    const data = {
      ...snapshot,
      _metadata: {
        updatedAt: new Date().toISOString(),
      },
    };

    const obj = this.objectNamespace.get(this.objectId);
    const stub = await obj.fetch(
      new Request(`https://dummy/snapshot/${key}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    );

    if (!stub.ok) {
      throw new Error(`Failed to persist snapshot: ${await stub.text()}`);
    }
  }

  async loadWorkflowSnapshot(params: {
    tableName: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { tableName, workflowName, runId } = params;
    const key = this.getKey(tableName, workflowName, runId);

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
  }

  async close(): Promise<void> {
    // No cleanup needed for Durable Objects
  }
}
