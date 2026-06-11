import type { TaskRecord } from './base';
import { TasksStorage } from './base';

/**
 * In-memory implementation of {@link TasksStorage}.
 *
 * Holds each thread's task list in a `Map<threadId, TaskRecord[]>`. Stored lists
 * are cloned on read and write so callers cannot mutate the backing array.
 *
 * This is the default tasks store wired by the composite store: task tracking
 * works out of the box without a configured backend, matching the previous
 * in-memory durability of the harness task list.
 */
export class InMemoryTasksStorage extends TasksStorage {
  private readonly tasksByThread = new Map<string, TaskRecord[]>();

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async getTasks(threadId: string): Promise<TaskRecord[]> {
    const tasks = this.tasksByThread.get(threadId);
    return tasks ? tasks.map(task => ({ ...task })) : [];
  }

  async setTasks(threadId: string, tasks: TaskRecord[]): Promise<void> {
    this.tasksByThread.set(
      threadId,
      tasks.map(task => ({ ...task })),
    );
  }

  async deleteTasks(threadId: string): Promise<void> {
    this.tasksByThread.delete(threadId);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.tasksByThread.clear();
  }
}
