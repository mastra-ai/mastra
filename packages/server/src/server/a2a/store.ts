import type { Task } from '@mastra/core/a2a';

export class InMemoryTaskStore {
  private store: Map<string, Task> = new Map();
  private versions: Map<string, number> = new Map();
  private listeners: Map<string, Set<(update: { task: Task; version: number }) => void>> = new Map();
  public activeCancellations = new Set<string>();

  private getKey(agentId: string, taskId: string) {
    return `${agentId}-${taskId}`;
  }

  async load({ agentId, taskId }: { agentId: string; taskId: string }): Promise<Task | null> {
    const entry = this.store.get(this.getKey(agentId, taskId));

    if (!entry) {
      return null;
    }

    // Return copies to prevent external mutation
    return { ...entry };
  }

  async save({ agentId, data }: { agentId: string; data: Task }): Promise<void> {
    // Store copies to prevent internal mutation if caller reuses objects
    const key = this.getKey(agentId, data.id);
    if (!data.id) {
      throw new Error('Task ID is required');
    }

    const storedTask = { ...data };
    const nextVersion = (this.versions.get(key) ?? 0) + 1;

    this.store.set(key, storedTask);
    this.versions.set(key, nextVersion);

    const listeners = this.listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        listener({ task: { ...storedTask }, version: nextVersion });
      }
    }
  }

  getVersion({ agentId, taskId }: { agentId: string; taskId: string }): number {
    return this.versions.get(this.getKey(agentId, taskId)) ?? 0;
  }

  async waitForNextUpdate({
    agentId,
    taskId,
    afterVersion,
  }: {
    agentId: string;
    taskId: string;
    afterVersion: number;
  }): Promise<{ task: Task; version: number }> {
    const key = this.getKey(agentId, taskId);
    const currentVersion = this.versions.get(key) ?? 0;
    const currentTask = this.store.get(key);

    if (currentTask && currentVersion > afterVersion) {
      return { task: { ...currentTask }, version: currentVersion };
    }

    return new Promise(resolve => {
      const listeners = this.listeners.get(key) ?? new Set<(update: { task: Task; version: number }) => void>();
      const listener = (update: { task: Task; version: number }) => {
        if (update.version <= afterVersion) {
          return;
        }

        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }

        resolve({ task: { ...update.task }, version: update.version });
      };

      listeners.add(listener);
      this.listeners.set(key, listeners);
    });
  }
}
