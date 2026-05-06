import type { BackgroundTask, TaskFilter, TaskListResult, UpdateBackgroundTask } from '../../../background-tasks/types';
import type { InMemoryDB } from '../inmemory-db';
import { BackgroundTasksStorage } from './base';

export class BackgroundTasksInMemory extends BackgroundTasksStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.backgroundTasks.clear();
  }

  async createTask(task: BackgroundTask): Promise<void> {
    this.db.backgroundTasks.set(task.id, { ...task });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const existing = this.db.backgroundTasks.get(taskId);
    if (!existing) return;
    this.db.backgroundTasks.set(taskId, { ...existing, ...update });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const task = this.db.backgroundTasks.get(taskId);
    return task ? { ...task } : null;
  }

  async listTasks(filter: TaskFilter): Promise<TaskListResult> {
    let tasks = Array.from(this.db.backgroundTasks.values());

    // Apply filters
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter(t => statuses.includes(t.status));
    }
    if (filter.agentId) {
      tasks = tasks.filter(t => t.agentId === filter.agentId);
    }
    if (filter.threadId) {
      tasks = tasks.filter(t => t.threadId === filter.threadId);
    }
    if (filter.resourceId) {
      tasks = tasks.filter(t => t.resourceId === filter.resourceId);
    }
    if (filter.toolName) {
      tasks = tasks.filter(t => t.toolName === filter.toolName);
    }
    if (filter.runId) {
      tasks = tasks.filter(t => t.runId === filter.runId);
    }

    // Date range filtering
    const dateCol = filter.dateFilterBy ?? 'createdAt';
    if (filter.fromDate) {
      tasks = tasks.filter(t => {
        const val = t[dateCol];
        return val != null && val >= filter.fromDate!;
      });
    }
    if (filter.toDate) {
      tasks = tasks.filter(t => {
        const val = t[dateCol];
        return val != null && val < filter.toDate!;
      });
    }

    // Sort
    const orderBy = filter.orderBy ?? 'createdAt';
    const direction = filter.orderDirection ?? 'asc';
    tasks.sort((a, b) => {
      const aVal = a[orderBy]?.getTime() ?? 0;
      const bVal = b[orderBy]?.getTime() ?? 0;
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Total count before pagination
    const total = tasks.length;

    // Pagination
    if (filter.page != null && filter.perPage != null) {
      const start = filter.page * filter.perPage;
      tasks = tasks.slice(start, start + filter.perPage);
    } else if (filter.perPage != null) {
      tasks = tasks.slice(0, filter.perPage);
    }

    // Return copies to prevent external mutation
    return { tasks: tasks.map(t => ({ ...t })), total };
  }

  async deleteTask(taskId: string): Promise<void> {
    this.db.backgroundTasks.delete(taskId);
  }

  async deleteTasks(filter: TaskFilter): Promise<void> {
    const { tasks } = await this.listTasks(filter);
    for (const task of tasks) {
      this.db.backgroundTasks.delete(task.id);
    }
  }

  async getRunningCount(): Promise<number> {
    let count = 0;
    for (const task of this.db.backgroundTasks.values()) {
      if (task.status === 'running') count++;
    }
    return count;
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    let count = 0;
    for (const task of this.db.backgroundTasks.values()) {
      if (task.status === 'running' && task.agentId === agentId) count++;
    }
    return count;
  }
}
