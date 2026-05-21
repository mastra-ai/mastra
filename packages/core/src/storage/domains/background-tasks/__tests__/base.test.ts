import { describe, expect, it } from 'vitest';

import type { BackgroundTask, TaskFilter, TaskListResult, UpdateBackgroundTask } from '../../../../background-tasks';
import { BackgroundTasksStorage } from '../base';

class LegacyBackgroundTasksStorage extends BackgroundTasksStorage {
  readonly tasks = new Map<string, BackgroundTask>();

  async createTask(task: BackgroundTask): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  async updateTask(taskId: string, update: UpdateBackgroundTask): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    this.tasks.set(taskId, { ...task, ...update });
  }

  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : null;
  }

  async listTasks(_filter: TaskFilter): Promise<TaskListResult> {
    return { tasks: [...this.tasks.values()], total: this.tasks.size };
  }

  async deleteTask(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
  }

  async deleteTasks(_filter: TaskFilter): Promise<void> {
    this.tasks.clear();
  }

  async getRunningCount(): Promise<number> {
    return [...this.tasks.values()].filter(task => task.status === 'running').length;
  }

  async getRunningCountByAgent(agentId: string): Promise<number> {
    return [...this.tasks.values()].filter(task => task.status === 'running' && task.agentId === agentId).length;
  }
}

function makeTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: 'task-1',
    status: 'pending',
    toolName: 'tool',
    toolCallId: 'call-1',
    args: {},
    agentId: 'agent-1',
    runId: 'run-1',
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 5000,
    createdAt: new Date('2026-05-20T00:00:00.000Z'),
    ...overrides,
  };
}

describe('BackgroundTasksStorage', () => {
  it('fails loudly for conditional-status updates on legacy adapters', async () => {
    const storage = new LegacyBackgroundTasksStorage();
    await storage.createTask(makeTask());

    await expect(storage.updateTaskIfStatus('task-1', 'pending', { status: 'running' })).rejects.toThrow(
      'BackgroundTasksStorage.updateTaskIfStatus must be implemented by this storage adapter',
    );
    await expect(storage.getTask('task-1')).resolves.toMatchObject({ status: 'pending' });
  });
});
