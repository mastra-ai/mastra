import { MastraStorage, WorkflowRunState } from '@mastra/core';
import { Redis } from '@upstash/redis';

export interface UpstashConfig {
  url: string;
  token: string;
}

export class UpstashStore extends MastraStorage {
  private redis: Redis;

  constructor(config: UpstashConfig) {
    super({ name: 'Upstash' });
    this.redis = new Redis({
      url: config.url,
      token: config.token,
    });
  }

  private getKey(namespace: string, workflowName: string, runId: string): string {
    return `${namespace}:${workflowName}:${runId}`;
  }

  async init(): Promise<void> {
    // No initialization needed for Redis
  }

  async clearNamespace(namespace: string): Promise<void> {
    const pattern = `${namespace}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async persistWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { namespace, workflowName, runId, snapshot } = params;
    const key = this.getKey(namespace, workflowName, runId);

    const data = {
      ...snapshot,
      _metadata: {
        updatedAt: new Date().toISOString(),
      },
    };

    await this.redis.set(key, JSON.stringify(data));
  }

  async loadWorkflowSnapshot(params: {
    namespace: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { namespace, workflowName, runId } = params;
    const key = this.getKey(namespace, workflowName, runId);

    const data = await this.redis.get<string>(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    // Remove metadata before returning
    const { _metadata, ...snapshot } = parsed;
    return snapshot;
  }

  async close(): Promise<void> {
    // No explicit cleanup needed for Upstash Redis
  }
}
