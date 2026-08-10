import type { Task } from '@mastra/core/a2a';

function createAbortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export class TaskStoreVersionConflictError extends Error {
  constructor(expectedVersion: number, currentVersion: number) {
    super(`Task version conflict: expected ${expectedVersion}, received ${currentVersion}`);
    this.name = 'TaskStoreVersionConflictError';
  }
}

export class InMemoryTaskStore {
  private store: Map<string, Task> = new Map();
  private versions: Map<string, number> = new Map();
  private listeners: Map<string, Set<(update: { task: Task; version: number }) => void>> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  public activeCancellations = new Set<string>();

  private getKey(agentId: string, taskId: string) {
    return `${agentId}-${taskId}`;
  }

  async load({ agentId, taskId }: { agentId: string; taskId: string }): Promise<Task | null> {
    const snapshot = this.loadWithVersion({ agentId, taskId });

    if (!snapshot) {
      return null;
    }

    return snapshot.task;
  }

  loadWithVersion({ agentId, taskId }: { agentId: string; taskId: string }): { task: Task; version: number } | null {
    const key = this.getKey(agentId, taskId);
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    return {
      task: { ...entry },
      version: this.versions.get(key) ?? 0,
    };
  }

  async save({
    agentId,
    data,
    expectedVersion,
    skipIfCanceled = false,
  }: {
    agentId: string;
    data: Task;
    expectedVersion?: number;
    skipIfCanceled?: boolean;
  }): Promise<Task> {
    // Store copies to prevent internal mutation if caller reuses objects
    const key = this.getKey(agentId, data.id);
    if (!data.id) {
      throw new Error('Task ID is required');
    }

    const existingTask = this.store.get(key);

    if (skipIfCanceled && existingTask?.status.state === 'canceled' && data.status.state !== 'canceled') {
      return { ...existingTask };
    }

    const currentVersion = this.versions.get(key) ?? 0;
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new TaskStoreVersionConflictError(expectedVersion, currentVersion);
    }

    const storedTask = { ...data };
    const nextVersion = currentVersion + 1;

    this.store.set(key, storedTask);
    this.versions.set(key, nextVersion);

    const listeners = this.listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        listener({ task: { ...storedTask }, version: nextVersion });
      }
    }

    return { ...storedTask };
  }

  getVersion({ agentId, taskId }: { agentId: string; taskId: string }): number {
    return this.versions.get(this.getKey(agentId, taskId)) ?? 0;
  }

  list({ agentId }: { agentId: string }): Task[] {
    const prefix = `${agentId}-`;

    return [...this.store.entries()].filter(([key]) => key.startsWith(prefix)).map(([, task]) => ({ ...task }));
  }

  registerAbortController({
    agentId,
    taskId,
    controller,
  }: {
    agentId: string;
    taskId: string;
    controller: AbortController;
  }): () => void {
    const key = this.getKey(agentId, taskId);
    this.abortControllers.set(key, controller);

    return () => {
      if (this.abortControllers.get(key) === controller) {
        this.abortControllers.delete(key);
      }
    };
  }

  abortTask({ agentId, taskId, reason }: { agentId: string; taskId: string; reason?: unknown }): void {
    const controller = this.abortControllers.get(this.getKey(agentId, taskId));

    if (controller && !controller.signal.aborted) {
      controller.abort(reason);
    }
  }

  async waitForNextUpdate({
    agentId,
    taskId,
    afterVersion,
    signal,
  }: {
    agentId: string;
    taskId: string;
    afterVersion: number;
    signal?: AbortSignal;
  }): Promise<{ task: Task; version: number }> {
    const key = this.getKey(agentId, taskId);
    const snapshot = this.loadWithVersion({ agentId, taskId });

    if (snapshot && snapshot.version > afterVersion) {
      return snapshot;
    }

    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    return new Promise((resolve, reject) => {
      const listeners = this.listeners.get(key) ?? new Set<(update: { task: Task; version: number }) => void>();
      let settled = false;

      const cleanup = () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
        signal?.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(createAbortError());
      };

      const listener = (update: { task: Task; version: number }) => {
        if (settled || signal?.aborted) {
          return;
        }

        if (update.version <= afterVersion) {
          return;
        }

        settled = true;
        cleanup();

        resolve({ task: { ...update.task }, version: update.version });
      };

      listeners.add(listener);
      this.listeners.set(key, listeners);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
