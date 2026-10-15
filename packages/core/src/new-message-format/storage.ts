import type { MastraAction, MastraActionType, PersistableAction } from './types';
import { isPersistable, toStoredAction } from './types';

export type ListActionsQuery = {
  threadId: string;
  runId?: string;
  types?: MastraActionType[];
  /** Exclusive ULID cursor. */
  after?: string;
  limit?: number;
};

/** Append-only action store keyed by threadId. Reads are ordered by ULID. */
export class InMemoryActionStorage {
  #threads = new Map<string, PersistableAction[]>();

  async saveActions({ actions }: { actions: PersistableAction[] }): Promise<void> {
    for (const action of actions) {
      const thread = this.#threads.get(action.threadId) ?? [];
      if (thread.some(existing => existing.id === action.id)) {
        throw new Error(`Action ${action.id} already exists; actions are append-only`);
      }
      thread.push(structuredClone(toStoredAction(action)));
      this.#threads.set(action.threadId, thread);
    }
  }

  async listActions({ threadId, runId, types, after, limit }: ListActionsQuery): Promise<PersistableAction[]> {
    const matching = (this.#threads.get(threadId) ?? [])
      .filter(a => (runId === undefined || a.runId === runId) && (!types || types.includes(a.type)))
      .filter(a => after === undefined || a.id > after)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return structuredClone(limit === undefined ? matching : matching.slice(0, limit));
  }

  /** Persists the persistable subset of a stream of actions. */
  async record(actions: MastraAction[]): Promise<void> {
    await this.saveActions({ actions: actions.filter(isPersistable) });
  }
}
