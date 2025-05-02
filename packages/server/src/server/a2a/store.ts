import type { TaskAndHistory } from '@mastra/core/a2a';

export class InMemoryTaskStore {
  private store: Map<string, TaskAndHistory> = new Map();

  async load({ agentId, taskId }: { agentId: string; taskId: string }): Promise<TaskAndHistory | null> {
    const entry = this.store.get(`${agentId}-${taskId}`);
    // Return copies to prevent external mutation
    return entry ? { task: { ...entry.task }, history: [...entry.history] } : null;
  }

  async save({ agentId, data }: { agentId: string; data: TaskAndHistory }): Promise<void> {
    // Store copies to prevent internal mutation if caller reuses objects
    this.store.set(`${agentId}-${data.task.id}`, {
      task: { ...data.task },
      history: [...data.history],
    });
  }
}

export const inMemoryTaskStore = new InMemoryTaskStore();

export const activeCancellations = new Set<string>();
