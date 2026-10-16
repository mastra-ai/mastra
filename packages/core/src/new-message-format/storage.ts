import type { MastraAction, MastraActionType, PersistableAction } from './types';
import { isPersistable } from './types';
import { createUlid } from './ulid';

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
      thread.push(structuredClone(action));
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

  async getLatestActionId(threadId: string): Promise<string | null> {
    return latestId(this.#threads.get(threadId));
  }

  /** Persists the persistable subset of a stream of actions. */
  async record(actions: MastraAction[]): Promise<void> {
    await this.saveActions({ actions: actions.filter(isPersistable) });
  }
}

/** Greatest id among a thread's actions, or null. */
export const latestId = (actions: Array<{ id: string }> | undefined): string | null =>
  (actions ?? []).reduce<string | null>((max, a) => (max === null || a.id > max ? a.id : max), null);

/**
 * The id generator every writer of a thread's actions must use: seeded from the thread's latest stored
 * id, so new ids sort after existing rows even when this host's clock is behind the one that wrote them.
 *
 * Create one per run and share it. Two generators seeded from the same latest id, with clocks at or
 * behind it, mint the same next id: a primary-key collision. In-process writers that share a run
 * (OM, title generation, background tools) must use the run's generator; separate processes rely on
 * one writer per thread.
 */
export async function createActionIdGenerator(
  store: { getLatestActionId(threadId: string): Promise<string | null> } | undefined,
  threadId: string,
): Promise<(now?: number) => string> {
  const after = store ? await store.getLatestActionId(threadId) : null;
  return createUlid(after === null ? {} : { after });
}
