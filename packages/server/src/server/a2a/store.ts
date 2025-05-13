import type { TaskAndHistory } from '@mastra/core/a2a';

export class InMemoryTaskStore {
  private store: Map<string, TaskAndHistory> = new Map();
  public activeCancellations = new Set<string>();

  async load({ agentId, taskId }: { agentId: string; taskId: string }): Promise<TaskAndHistory | null> {
    const entry = this.store.get(`${agentId}-${taskId}`);

    if (!entry) {
      return null;
    }

    // Return copies to prevent external mutation
    return { task: { ...entry.task }, history: [...entry.history] };
  }

  async save({ agentId, data }: { agentId: string; data: TaskAndHistory }): Promise<void> {
    // Store copies to prevent internal mutation if caller reuses objects
    const key = `${agentId}-${data.task.id}`;
    if (!data.task.id) {
      throw new Error('Task ID is required');
    }
    this.store.set(key, {
      task: { ...data.task },
      history: [...data.history],
    });
  }
}
