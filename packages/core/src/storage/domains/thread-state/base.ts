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
 * A durable goal objective for an agent thread.
 *
 * Stored in the thread-state domain under `type: 'goal'`. The objective drives
 * the in-loop goal scorer (the agent keeps working until the goal is judged
 * complete or the run budget is exhausted). All settings except `objective`,
 * `status`, and `runsUsed` are optional: when absent here they fall back to the
 * Agent's `goal` config at read time, so an objective only persists the fields a
 * caller explicitly provided. `judgeModelId` is required at runtime for the goal
 * to do anything — when neither this record nor the Agent's `goal.judge`
 * resolves a judge model, the goal step is a no-op.
 */
export interface GoalObjectiveRecord {
  /** The prose objective the agent is working toward. */
  objective: string;
  status: 'active' | 'paused' | 'done';
  /** Number of goal evaluations consumed so far. */
  runsUsed: number;
  /** Max evaluations before the goal stops. Falls back to agent `goal.maxRuns` (default 50). */
  maxRuns?: number;
  /** Judge model id. Falls back to agent `goal.judge`; if neither resolves the goal is a no-op. */
  judgeModelId?: string;
  /** Extra judge guidance. Falls back to agent `goal.prompt` (default = built-in goal judge prompt). */
  prompt?: string;
  /**
   * Why the objective is `paused`, when applicable. Distinguishes the pause
   * causes for the UI / resume flow: an explicit user checkpoint requested by
   * the goal ("waiting"), or a judge/scorer failure. Unset for `active`/`done`.
   */
  pausedReason?: string;
  startedAt: number;
  updatedAt: number;
}

/**
 * Abstract base class for the thread-state storage domain.
 *
 * The thread-state domain holds arbitrary, durable, per-thread state keyed by a
 * `type` namespace. Each `(threadId, type)` pair owns one value. Today the only
 * types are `'task'` (the structured task list managed by the built-in task
 * tools) and `'goal'` (the durable {@link GoalObjectiveRecord} that drives the
 * in-loop goal scorer). The domain is intentionally generic so other
 * agent-scoped state can be tracked the same way without a new domain.
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
