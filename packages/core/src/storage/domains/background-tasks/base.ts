import type {
  BackgroundTask,
  BackgroundTaskStatus,
  TaskFilter,
  TaskListResult,
  UpdateBackgroundTask,
} from '../../../background-tasks/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { createStorageErrorId } from '../../utils';
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
   * Only the provided fields are updated; others are left unchanged.
   */
  abstract updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void>;

  /**
   * Update a task only when its current status still matches the expected state.
   * Implementations should use the strongest conditional write primitive the
   * backend supports and return false when the expected status no longer
   * matches. The default fails closed for external adapters that have not yet
   * implemented the conditional claim contract.
   */
  async updateTaskIfStatus(
    taskId: string,
    expectedStatus: BackgroundTaskStatus,
    update: UpdateBackgroundTask,
  ): Promise<boolean> {
    throw new MastraError(
      {
        id: createStorageErrorId('MASTRA', 'UPDATE_BACKGROUND_TASK_IF_STATUS', 'NOT_SUPPORTED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: {
          taskId,
          expectedStatus,
          updateStatus: update.status ?? null,
        },
      },
      'Background task dispatch requires storage support for atomic conditional status updates.',
    );
  }

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
