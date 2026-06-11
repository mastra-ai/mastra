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
 * Abstract base class for the tasks storage domain.
 *
 * The tasks domain is the source of truth for an agent's structured task list.
 * It is **thread-scoped**: each thread owns one task list. The built-in task
 * tools read/write it synchronously within a run (so a `task_update` sees the
 * tasks a prior `task_write` produced), and the task state processor reads it to
 * project the list onto the agent state-signal lane.
 */
export abstract class TasksStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'TASKS',
    });
  }

  /**
   * Initialize the tasks store (create tables, indexes, etc).
   */
  abstract init(): Promise<void>;

  /**
   * Get the task list for a thread. Returns an empty array when the thread has
   * no tasks yet.
   */
  abstract getTasks(threadId: string): Promise<TaskRecord[]>;

  /**
   * Replace the task list for a thread with `tasks`. Full-replacement semantics:
   * the stored list becomes exactly `tasks`.
   */
  abstract setTasks(threadId: string, tasks: TaskRecord[]): Promise<void>;

  /**
   * Delete the task list for a thread.
   */
  abstract deleteTasks(threadId: string): Promise<void>;

  /**
   * Delete all task lists. Used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
