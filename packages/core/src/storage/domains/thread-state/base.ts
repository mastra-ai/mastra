import { MastraBase } from '../../../base';

/**
 * A single task in an agent's structured task list.
 *
 * Mirrors the task shape used by the built-in task tools. Kept as a plain,
 * self-contained type so the storage domain does not depend on the tools
 * package.
 */
export interface TaskRecord {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

/**
 * Abstract base class for the thread-state storage domain.
 *
 * The thread-state domain holds arbitrary, durable, per-thread state keyed by a
 * `type` namespace. Each `(threadId, type)` pair owns one value. Today the only
 * type is `'task'` (the structured task list managed by the built-in task
 * tools), but the domain is intentionally generic so other agent-scoped state
 * (e.g. `'goal'`) can be tracked the same way without a new domain.
 *
 * The built-in task tools read/write the `'task'` slot synchronously within a
 * run (so a `task_update` sees the tasks a prior `task_write` produced), and the
 * task state processor reads it to project the list onto the agent state-signal
 * lane.
 */
export abstract class ThreadStateStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'THREAD_STATE',
    });
  }

  /**
   * Initialize the thread-state store (create tables, indexes, etc).
   */
  abstract init(): Promise<void>;

  /**
   * Get the state value for a `(threadId, type)` pair. Returns `undefined` when
   * no value has been set.
   */
  abstract getState<T = unknown>(args: { threadId: string; type: string }): Promise<T | undefined>;

  /**
   * Set the state value for a `(threadId, type)` pair. Full-replacement
   * semantics: the stored value becomes exactly `value`.
   */
  abstract setState<T = unknown>(args: { threadId: string; type: string; value: T }): Promise<void>;

  /**
   * Delete the state value for a `(threadId, type)` pair.
   */
  abstract deleteState(args: { threadId: string; type: string }): Promise<void>;

  /**
   * Delete all thread state. Used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
