import { describe, it, expect, beforeEach } from 'vitest';
import type { BackgroundTask } from '../../../../background-tasks/types';
import { InMemoryDB } from '../../inmemory-db';
import { BackgroundTasksInMemory } from '../inmemory';

function makeTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: crypto.randomUUID(),
    status: 'pending',
    toolName: 'test-tool',
    runId: 'run-1',
    toolCallId: 'call-1',
    args: { query: 'test' },
    agentId: 'agent-1',
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 300_000,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('BackgroundTasksInMemory', () => {
  let db: InMemoryDB;
  let storage: BackgroundTasksInMemory;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new BackgroundTasksInMemory({ db });
  });

  describe('createTask', () => {
    it('creates a task', async () => {
      const task = makeTask();
      await storage.createTask(task);

      const result = await storage.getTask(task.id);
      expect(result).toBeDefined();
      expect(result!.id).toBe(task.id);
      expect(result!.toolName).toBe('test-tool');
    });

    it('stores a copy — original mutations do not affect stored task', async () => {
      const task = makeTask();
      await storage.createTask(task);

      task.status = 'running';

      const result = await storage.getTask(task.id);
      expect(result!.status).toBe('pending');
    });
  });

  describe('updateTask', () => {
    it('updates specific fields', async () => {
      const task = makeTask();
      await storage.createTask(task);

      await storage.updateTask(task.id, {
        status: 'running',
        startedAt: new Date(),
      });

      const result = await storage.getTask(task.id);
      expect(result!.status).toBe('running');
      expect(result!.startedAt).toBeDefined();
      expect(result!.toolName).toBe('test-tool'); // unchanged
    });

    it('is a no-op for non-existent tasks', async () => {
      await storage.updateTask('non-existent', { status: 'running' });
      // Should not throw
    });
  });

  describe('getTask', () => {
    it('returns null for non-existent task', async () => {
      const result = await storage.getTask('non-existent');
      expect(result).toBeNull();
    });

    it('returns a copy — mutations do not affect stored task', async () => {
      const task = makeTask();
      await storage.createTask(task);

      const result = await storage.getTask(task.id);
      result!.status = 'failed';

      const result2 = await storage.getTask(task.id);
      expect(result2!.status).toBe('pending');
    });
  });

  describe('listTasks', () => {
    it('returns all tasks when no filter', async () => {
      await storage.createTask(makeTask({ id: '1' }));
      await storage.createTask(makeTask({ id: '2' }));
      await storage.createTask(makeTask({ id: '3' }));

      const result = await storage.listTasks({});
      expect(result.total).toBe(3);
    });

    it('filters by status', async () => {
      await storage.createTask(makeTask({ id: '1', status: 'pending' }));
      await storage.createTask(makeTask({ id: '2', status: 'running' }));
      await storage.createTask(makeTask({ id: '3', status: 'completed' }));

      const pending = await storage.listTasks({ status: 'pending' });
      expect(pending.total).toBe(1);
      expect(pending.tasks[0]!.id).toBe('1');

      const multiple = await storage.listTasks({ status: ['pending', 'running'] });
      expect(multiple.total).toBe(2);
    });

    it('filters by agentId', async () => {
      await storage.createTask(makeTask({ id: '1', agentId: 'a1' }));
      await storage.createTask(makeTask({ id: '2', agentId: 'a2' }));

      const result = await storage.listTasks({ agentId: 'a1' });
      expect(result.total).toBe(1);
      expect(result.tasks[0]!.agentId).toBe('a1');
    });

    it('filters by threadId', async () => {
      await storage.createTask(makeTask({ id: '1', threadId: 't1' }));
      await storage.createTask(makeTask({ id: '2', threadId: 't2' }));
      await storage.createTask(makeTask({ id: '3' })); // no threadId

      const result = await storage.listTasks({ threadId: 't1' });
      expect(result.total).toBe(1);
    });

    it('filters by toolName', async () => {
      await storage.createTask(makeTask({ id: '1', toolName: 'research' }));
      await storage.createTask(makeTask({ id: '2', toolName: 'lookup' }));

      const result = await storage.listTasks({ toolName: 'research' });
      expect(result.total).toBe(1);
    });

    it('filters by date ranges', async () => {
      const now = new Date();
      const old = new Date(now.getTime() - 100_000);
      const future = new Date(now.getTime() + 100_000);

      await storage.createTask(makeTask({ id: '1', createdAt: old }));
      await storage.createTask(makeTask({ id: '2', createdAt: now }));
      await storage.createTask(makeTask({ id: '3', createdAt: future }));

      const result = await storage.listTasks({ toDate: now, dateFilterBy: 'createdAt' });
      expect(result.total).toBe(1);
      expect(result.tasks[0]!.id).toBe('1');

      const result2 = await storage.listTasks({ fromDate: now, dateFilterBy: 'createdAt' });
      expect(result2.total).toBe(2);
      expect(result2.tasks[0]!.id).toBe('2');
    });

    it('filters by completedBefore', async () => {
      const now = new Date();
      const old = new Date(now.getTime() - 100_000);

      await storage.createTask(makeTask({ id: '1', status: 'completed', completedAt: old }));
      await storage.createTask(makeTask({ id: '2', status: 'completed', completedAt: now }));
      await storage.createTask(makeTask({ id: '3', status: 'pending' })); // no completedAt

      const result = await storage.listTasks({ toDate: now, dateFilterBy: 'completedAt' });
      expect(result.total).toBe(1);
      expect(result.tasks[0]!.id).toBe('1');
    });

    it('sorts by createdAt ascending (default)', async () => {
      const t1 = new Date('2024-01-01');
      const t2 = new Date('2024-01-02');
      const t3 = new Date('2024-01-03');

      await storage.createTask(makeTask({ id: '3', createdAt: t3 }));
      await storage.createTask(makeTask({ id: '1', createdAt: t1 }));
      await storage.createTask(makeTask({ id: '2', createdAt: t2 }));

      const result = await storage.listTasks({});
      expect(result.tasks.map(t => t.id)).toEqual(['1', '2', '3']);
    });

    it('sorts descending', async () => {
      const t1 = new Date('2024-01-01');
      const t2 = new Date('2024-01-02');

      await storage.createTask(makeTask({ id: '1', createdAt: t1 }));
      await storage.createTask(makeTask({ id: '2', createdAt: t2 }));

      const result = await storage.listTasks({ orderDirection: 'desc' });
      expect(result.tasks.map(t => t.id)).toEqual(['2', '1']);
    });

    it('supports page and perPage', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.createTask(makeTask({ id: `${i}`, createdAt: new Date(2024, 0, i + 1) }));
      }

      const page = await storage.listTasks({ perPage: 2, page: 0 });
      expect(page.total).toBe(5);
      expect(page.tasks.length).toBe(2);
      expect(page.tasks[0]!.id).toBe('0');
      expect(page.tasks[1]!.id).toBe('1');
    });
  });

  describe('deleteTasks', () => {
    it('deletes tasks matching filter', async () => {
      await storage.createTask(makeTask({ id: '1', status: 'completed' }));
      await storage.createTask(makeTask({ id: '2', status: 'completed' }));
      await storage.createTask(makeTask({ id: '3', status: 'running' }));

      await storage.deleteTasks({ status: 'completed' });

      const all = await storage.listTasks({});
      expect(all.total).toBe(1);
      expect(all.tasks[0]!.id).toBe('3');
    });

    it('deletes with multiple status filter', async () => {
      await storage.createTask(makeTask({ id: '1', status: 'completed' }));
      await storage.createTask(makeTask({ id: '2', status: 'failed' }));
      await storage.createTask(makeTask({ id: '3', status: 'pending' }));

      await storage.deleteTasks({ status: ['completed', 'failed'] });

      const all = await storage.listTasks({});
      expect(all.total).toBe(1);
      expect(all.tasks[0]!.id).toBe('3');
    });
  });

  describe('getRunningCount', () => {
    it('counts running tasks', async () => {
      await storage.createTask(makeTask({ id: '1', status: 'running' }));
      await storage.createTask(makeTask({ id: '2', status: 'running' }));
      await storage.createTask(makeTask({ id: '3', status: 'pending' }));
      await storage.createTask(makeTask({ id: '4', status: 'completed' }));

      const count = await storage.getRunningCount();
      expect(count).toBe(2);
    });

    it('returns 0 when no running tasks', async () => {
      await storage.createTask(makeTask({ status: 'pending' }));

      const count = await storage.getRunningCount();
      expect(count).toBe(0);
    });
  });

  describe('getRunningCountByAgent', () => {
    it('counts running tasks for a specific agent', async () => {
      await storage.createTask(makeTask({ id: '1', status: 'running', agentId: 'a1' }));
      await storage.createTask(makeTask({ id: '2', status: 'running', agentId: 'a1' }));
      await storage.createTask(makeTask({ id: '3', status: 'running', agentId: 'a2' }));
      await storage.createTask(makeTask({ id: '4', status: 'pending', agentId: 'a1' }));

      const count = await storage.getRunningCountByAgent('a1');
      expect(count).toBe(2);
    });
  });

  describe('dangerouslyClearAll', () => {
    it('removes all tasks', async () => {
      await storage.createTask(makeTask({ id: '1' }));
      await storage.createTask(makeTask({ id: '2' }));

      await storage.dangerouslyClearAll();

      const all = await storage.listTasks({});
      expect(all.total).toBe(0);
    });
  });
});
