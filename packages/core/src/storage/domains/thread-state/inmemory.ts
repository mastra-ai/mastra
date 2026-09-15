import { ThreadStateStorage } from './base';

function clone<T>(value: T): T {
  return value === undefined ? value : (structuredClone(value) as T);
}

/**
 * In-memory implementation of {@link ThreadStateStorage}.
 *
 * Holds each thread's state in a `Map<threadId, Map<type, value>>`. Stored
 * values are cloned on read and write so callers cannot mutate the backing
 * value.
 *
 * This is the default thread-state store wired by the composite store: task
 * tracking works out of the box without a configured backend. It is **not**
 * durable across process restarts — configure a durable backend (e.g.
 * `@mastra/libsql`) for state that must survive a restart.
 */
export class InMemoryThreadStateStorage extends ThreadStateStorage {
  private readonly stateByThread = new Map<string, Map<string, unknown>>();

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async getState<T = unknown>({ threadId, type }: { threadId: string; type: string }): Promise<T | undefined> {
    const value = this.stateByThread.get(threadId)?.get(type);
    return value === undefined ? undefined : clone(value as T);
  }

  async setState<T = unknown>({ threadId, type, value }: { threadId: string; type: string; value: T }): Promise<void> {
    let byType = this.stateByThread.get(threadId);
    if (!byType) {
      byType = new Map<string, unknown>();
      this.stateByThread.set(threadId, byType);
    }
    byType.set(type, clone(value));
  }

  async deleteState({ threadId, type }: { threadId: string; type: string }): Promise<void> {
    const byType = this.stateByThread.get(threadId);
    if (!byType) return;
    byType.delete(type);
    if (byType.size === 0) this.stateByThread.delete(threadId);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.stateByThread.clear();
  }
}
