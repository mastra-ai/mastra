import type {
  BackgroundTask,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
  UpdateBackgroundTaskOptions,
} from '../../../background-tasks/types';
import { StorageDomain } from '../base';

/**
 * Abstract storage domain for background tasks.
 * Handles persistence of task state — creation, status updates, querying, and cleanup.
 */
export abstract class BackgroundTasksStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'BACKGROUND_TASKS',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  /** Insert a new task record. */
  abstract createTask(task: BackgroundTask): Promise<void>;

  /**
   * Partial update of a task record.
   * Only the provided fields are updated; others are left unchanged. Field
   * presence is significant: passing `ownerId: undefined` clears the column,
   * it does not skip it.
   *
   * The optional conditions in `options` make the write a compare-and-set —
   * it is applied only if the stored row still matches every supplied
   * condition. `expectedOwnerId` / `expectedLeaseExpiresAt` fence writes from
   * superseded owners so a worker that lost its lease cannot commit results.
   * Returns whether the update was applied.
   */
  abstract updateTask(
    taskId: string,
    update: UpdateBackgroundTask,
    options?: UpdateBackgroundTaskOptions,
  ): Promise<boolean>;

  /** Get a single task by ID. Returns null if not found. */
  abstract getTask(taskId: string): Promise<BackgroundTask | null>;

  /**
   * Query tasks with filters, ordering, and pagination.
   * Returns tasks matching all provided filter criteria.
   */
  abstract listTasks(filter: TaskFilter): Promise<TaskListResult>;

  /**
   * Delete a particular task by ID.
   * Used for cleanup of old completed/failed records.
   */
  abstract deleteTask(taskId: string): Promise<void>;

  /**
   * Delete tasks matching the filter criteria.
   * Used for cleanup of old completed/failed records.
   */
  abstract deleteTasks(filter: TaskFilter): Promise<void>;

  /** Count tasks currently in 'running' status across all agents. */
  abstract getRunningCount(): Promise<number>;

  /** Count tasks currently in 'running' status for a specific agent. */
  abstract getRunningCountByAgent(agentId: string): Promise<number>;
}
