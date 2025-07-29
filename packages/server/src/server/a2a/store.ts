import type { Task } from '@mastra/core/a2a';

export class InMemoryTaskStore {
  private store: Map<string, Task> = new Map();
  public activeCancellations = new Set<string>();

  async load({ agentId, taskId }: { agentId: string; taskId: string }): Promise<Task | null> {
    const entry = this.store.get(`${agentId}-${taskId}`);
    console.log('LOAD______________________________________________________');
    console.log(`${agentId}-${taskId}`);
    console.log(entry);
    console.log(this.store);
    console.log('____________________________________________________________');

    if (!entry) {
      return null;
    }

    // Return copies to prevent external mutation
    return entry;
  }

  async save({ agentId, data }: { agentId: string; data: Task }): Promise<void> {
    console.log('SAVE______________________________________________________');
    console.log(`${agentId}-${data.id}`);
    console.log(data);
    console.log(this.store);
    console.log('____________________________________________________________');
    // Store copies to prevent internal mutation if caller reuses objects
    const key = `${agentId}-${data.id}`;
    if (!data.id) {
      throw new Error('Task ID is required');
    }
    this.store.set(key, data);
    console.log('SAVE2______________________________________________________');
    console.log(this.store);
    console.log('____________________________________________________________');
  }
}
