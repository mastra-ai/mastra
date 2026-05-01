import type { BackgroundTasksStorage } from '@mastra/core/storage';
import type { MastraStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { createSampleTask } from './data';

export interface BackgroundTasksTestOptions {
  storage: MastraStorage;
}

export function createBackgroundTasksTests({ storage }: BackgroundTasksTestOptions) {
  let bgStorage: BackgroundTasksStorage;

  beforeAll(async () => {
    const store = await storage.getStore('backgroundTasks');
    if (!store) {
      // Domain is optional — skip if not available
      return;
    }
    bgStorage = store;
  });

  describe('Background Tasks', () => {
    beforeEach(async () => {
      if (!bgStorage) return;
      await bgStorage.dangerouslyClearAll();
    });

    describe('createTask + getTask', () => {
      it('creates and retrieves a task', async () => {
        if (!bgStorage) return;
        const task = createSampleTask();
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result).toBeDefined();
        expect(result!.id).toBe(task.id);
        expect(result!.toolName).toBe('test-tool');
        expect(result!.toolCallId).toBe(task.toolCallId);
        expect(result!.agentId).toBe('agent-1');
        expect(result!.status).toBe('pending');
        expect(result!.args).toEqual({ query: 'test' });
        expect(result!.retryCount).toBe(0);
        expect(result!.maxRetries).toBe(0);
        expect(result!.timeoutMs).toBe(300_000);
        expect(result!.createdAt).toBeInstanceOf(Date);
      });

      it('returns null for non-existent task', async () => {
        if (!bgStorage) return;
        const result = await bgStorage.getTask('non-existent');
        expect(result).toBeNull();
      });

      it('stores and retrieves result as JSON', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'completed',
          result: { summary: 'hello', data: [1, 2, 3] },
          completedAt: new Date(),
        });
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.result).toEqual({ summary: 'hello', data: [1, 2, 3] });
      });

      it('stores and retrieves error as JSON', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'failed',
          error: { message: 'Something broke', stack: 'at line 1' },
          completedAt: new Date(),
        });
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.error).toEqual({ message: 'Something broke', stack: 'at line 1' });
      });

      it('handles nullable fields', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ threadId: undefined, resourceId: undefined });
        await bgStorage.createTask(task);

        const result = await bgStorage.getTask(task.id);
        expect(result!.threadId).toBeUndefined();
        expect(result!.resourceId).toBeUndefined();
      });
    });

    describe('updateTask', () => {
      it('updates status and timestamps', async () => {
        if (!bgStorage) return;
        const task = createSampleTask();
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, { status: 'running', startedAt: new Date() });

        const result = await bgStorage.getTask(task.id);
        expect(result!.status).toBe('running');
        expect(result!.startedAt).toBeInstanceOf(Date);
      });

      it('updates result on completion', async () => {
        if (!bgStorage) return;
        const task = createSampleTask();
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, {
          status: 'completed',
          result: { data: 'done' },
          completedAt: new Date(),
        });

        const result = await bgStorage.getTask(task.id);
        expect(result!.status).toBe('completed');
        expect(result!.result).toEqual({ data: 'done' });
        expect(result!.completedAt).toBeInstanceOf(Date);
      });

      it('updates retry count', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ maxRetries: 3 });
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, { retryCount: 2 });

        const result = await bgStorage.getTask(task.id);
        expect(result!.retryCount).toBe(2);
      });

      it('clears error on retry', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({
          status: 'failed',
          error: { message: 'temp error' },
        });
        await bgStorage.createTask(task);

        await bgStorage.updateTask(task.id, { status: 'pending', error: undefined });

        const result = await bgStorage.getTask(task.id);
        expect(result!.status).toBe('pending');
        expect(result!.error).toBeUndefined();
      });
    });

    describe('listTasks', () => {
      it('lists all tasks', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask());
        await bgStorage.createTask(createSampleTask());
        await bgStorage.createTask(createSampleTask());

        const { tasks, total } = await bgStorage.listTasks({});
        expect(tasks.length).toBe(3);
        expect(total).toBe(3);
      });

      it('filters by status', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));

        const { tasks: pending } = await bgStorage.listTasks({ status: 'pending' });
        expect(pending.length).toBe(1);

        const { tasks: multiple } = await bgStorage.listTasks({ status: ['pending', 'running'] });
        expect(multiple.length).toBe(2);
      });

      it('filters by agentId', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ agentId: 'a1' }));
        await bgStorage.createTask(createSampleTask({ agentId: 'a2' }));

        const { tasks } = await bgStorage.listTasks({ agentId: 'a1' });
        expect(tasks.length).toBe(1);
        expect(tasks[0]!.agentId).toBe('a1');
      });

      it('filters by threadId', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ threadId: 't1' }));
        await bgStorage.createTask(createSampleTask({ threadId: 't2' }));

        const { tasks } = await bgStorage.listTasks({ threadId: 't1' });
        expect(tasks.length).toBe(1);
      });

      it('filters by toolName', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ toolName: 'research' }));
        await bgStorage.createTask(createSampleTask({ toolName: 'lookup' }));

        const { tasks } = await bgStorage.listTasks({ toolName: 'research' });
        expect(tasks.length).toBe(1);
      });

      it('orders by createdAt ascending by default', async () => {
        if (!bgStorage) return;
        const t1 = new Date('2024-01-01');
        const t2 = new Date('2024-01-02');
        const t3 = new Date('2024-01-03');

        await bgStorage.createTask(createSampleTask({ id: '3', createdAt: t3 }));
        await bgStorage.createTask(createSampleTask({ id: '1', createdAt: t1 }));
        await bgStorage.createTask(createSampleTask({ id: '2', createdAt: t2 }));

        const { tasks } = await bgStorage.listTasks({});
        expect(tasks.map(t => t.id)).toEqual(['1', '2', '3']);
      });

      it('supports descending order', async () => {
        if (!bgStorage) return;
        const t1 = new Date('2024-01-01');
        const t2 = new Date('2024-01-02');

        await bgStorage.createTask(createSampleTask({ id: '1', createdAt: t1 }));
        await bgStorage.createTask(createSampleTask({ id: '2', createdAt: t2 }));

        const { tasks } = await bgStorage.listTasks({ orderDirection: 'desc' });
        expect(tasks.map(t => t.id)).toEqual(['2', '1']);
      });

      it('supports page and perPage', async () => {
        if (!bgStorage) return;
        for (let i = 0; i < 5; i++) {
          await bgStorage.createTask(createSampleTask({ id: `${i}`, createdAt: new Date(2024, 0, i + 1) }));
        }

        const { tasks: page0, total } = await bgStorage.listTasks({ page: 0, perPage: 2 });
        expect(page0.length).toBe(2);
        expect(total).toBe(5);
        expect(page0[0]!.id).toBe('0');
        expect(page0[1]!.id).toBe('1');

        const { tasks: page1 } = await bgStorage.listTasks({ page: 1, perPage: 2 });
        expect(page1.length).toBe(2);
        expect(page1[0]!.id).toBe('2');
        expect(page1[1]!.id).toBe('3');
      });
    });

    describe('deleteTask', () => {
      it('deletes a single task synchronously', async () => {
        if (!bgStorage) return;
        const task = createSampleTask({ id: 'delete-one' });
        await bgStorage.createTask(task);

        await bgStorage.deleteTask(task.id);

        expect(await bgStorage.getTask(task.id)).toBeNull();
      });
    });

    describe('deleteTasks', () => {
      it('deletes tasks matching status filter', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));

        await bgStorage.deleteTasks({ status: 'completed' });

        const { total } = await bgStorage.listTasks({});
        expect(total).toBe(1);
      });

      it('deletes with multiple status filter', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'completed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'failed', completedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));

        await bgStorage.deleteTasks({ status: ['completed', 'failed'] });

        const { total } = await bgStorage.listTasks({});
        expect(total).toBe(1);
      });
    });

    describe('getRunningCount', () => {
      it('counts running tasks', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));

        const count = await bgStorage.getRunningCount();
        expect(count).toBe(2);
      });

      it('returns 0 when no running tasks', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'pending' }));

        const count = await bgStorage.getRunningCount();
        expect(count).toBe(0);
      });
    });

    describe('getRunningCountByAgent', () => {
      it('counts running tasks for specific agent', async () => {
        if (!bgStorage) return;
        await bgStorage.createTask(createSampleTask({ status: 'running', agentId: 'a1', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', agentId: 'a1', startedAt: new Date() }));
        await bgStorage.createTask(createSampleTask({ status: 'running', agentId: 'a2', startedAt: new Date() }));

        expect(await bgStorage.getRunningCountByAgent('a1')).toBe(2);
        expect(await bgStorage.getRunningCountByAgent('a2')).toBe(1);
        expect(await bgStorage.getRunningCountByAgent('a3')).toBe(0);
      });
    });
  });
}
