import { describe, it, expect, beforeEach } from 'vitest';
import { Inbox } from '../inbox';
import { Mastra } from '../../mastra';
import { InMemoryInboxStorage } from '../../storage/domains/inbox/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { MastraStorage } from '../../storage/base';
import { TaskStatus, TaskPriority } from '../types';

// Create a minimal storage with inbox support
function createTestStorage() {
  const db = new InMemoryDB();
  const inboxStorage = new InMemoryInboxStorage({ db });

  // Create a MastraStorage that wraps the inbox storage
  const storage = new MastraStorage({
    id: 'test-storage',
    domains: {
      inbox: inboxStorage,
      // Provide minimal implementations for required domains
      memory: undefined as any,
      workflows: undefined as any,
      scores: undefined as any,
    },
  });

  return { storage, inboxStorage, db };
}

describe('Inbox', () => {
  let inbox: Inbox;
  let mastra: Mastra;
  let db: InMemoryDB;

  beforeEach(() => {
    const { storage, db: testDb } = createTestStorage();
    db = testDb;

    mastra = new Mastra({
      storage,
    });

    inbox = new Inbox({ id: 'test-inbox' });
    inbox.__registerMastra(mastra);
  });

  describe('Producer API', () => {
    it('should add a task to the inbox', async () => {
      const task = await inbox.add({
        type: 'test',
        payload: { message: 'Hello' },
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.inboxId).toBe('test-inbox');
      expect(task.type).toBe('test');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.payload).toEqual({ message: 'Hello' });
    });

    it('should add a task with priority', async () => {
      const task = await inbox.add({
        type: 'urgent',
        payload: { message: 'Important' },
        priority: TaskPriority.HIGH,
      });

      expect(task.priority).toBe(TaskPriority.HIGH);
    });

    it('should add multiple tasks in batch', async () => {
      const tasks = await inbox.addBatch([
        { type: 'task1', payload: { n: 1 } },
        { type: 'task2', payload: { n: 2 } },
        { type: 'task3', payload: { n: 3 } },
      ]);

      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.type)).toEqual(['task1', 'task2', 'task3']);
    });

    it('should add a task with title and metadata', async () => {
      const task = await inbox.add({
        type: 'support',
        payload: { issue: 'Bug report' },
        title: 'User cannot login',
        metadata: { userId: '123', source: 'web' },
      });

      expect(task.title).toBe('User cannot login');
      expect(task.metadata).toEqual({ userId: '123', source: 'web' });
    });
  });

  describe('Consumer API', () => {
    it('should claim a task', async () => {
      await inbox.add({ type: 'test', payload: {} });

      const claimed = await inbox.claim('agent-1');

      expect(claimed).toBeDefined();
      expect(claimed!.status).toBe(TaskStatus.CLAIMED);
      expect(claimed!.claimedBy).toBe('agent-1');
      expect(claimed!.claimedAt).toBeDefined();
    });

    it('should return null when no tasks are available', async () => {
      const claimed = await inbox.claim('agent-1');
      expect(claimed).toBeNull();
    });

    it('should claim tasks by priority order', async () => {
      await inbox.add({ type: 'low', payload: {}, priority: TaskPriority.LOW });
      await inbox.add({ type: 'high', payload: {}, priority: TaskPriority.HIGH });
      await inbox.add({ type: 'normal', payload: {}, priority: TaskPriority.NORMAL });

      const first = await inbox.claim('agent-1');
      const second = await inbox.claim('agent-1');
      const third = await inbox.claim('agent-1');

      expect(first!.type).toBe('high');
      expect(second!.type).toBe('normal');
      expect(third!.type).toBe('low');
    });

    it('should claim tasks filtered by type', async () => {
      await inbox.add({ type: 'bug', payload: {} });
      await inbox.add({ type: 'feature', payload: {} });
      await inbox.add({ type: 'bug', payload: {} });

      const claimed = await inbox.claim('agent-1', { types: ['feature'] });

      expect(claimed!.type).toBe('feature');
    });

    it('should start a task', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');

      await inbox.startTask(task.id);

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updated!.startedAt).toBeDefined();
    });

    it('should complete a task', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');
      await inbox.startTask(task.id);

      await inbox.complete(task.id, { result: 'success' });

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.COMPLETED);
      expect(updated!.result).toEqual({ result: 'success' });
      expect(updated!.completedAt).toBeDefined();
    });

    it('should fail a task and schedule retry', async () => {
      // maxAttempts: 5 means we can fail 4 times and still retry
      const task = await inbox.add({ type: 'test', payload: {}, maxAttempts: 5 });
      await inbox.claim('agent-1');
      await inbox.startTask(task.id);

      // Use a retryable error (network error)
      await inbox.fail(task.id, new Error('Network error: fetch failed'));

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.PENDING); // Pending for retry
      expect(updated!.attempts).toBe(1);
      expect(updated!.nextRetryAt).toBeDefined();
    });

    it('should fail permanently after max attempts', async () => {
      const task = await inbox.add({ type: 'test', payload: {}, maxAttempts: 1 });
      await inbox.claim('agent-1');
      await inbox.startTask(task.id);

      await inbox.fail(task.id, new Error('Something went wrong'));

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.FAILED);
      expect(updated!.attempts).toBe(1);
    });

    it('should release a claimed task', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');

      await inbox.release(task.id);

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.PENDING);
      expect(updated!.claimedBy).toBeUndefined();
    });

    it('should cancel a task', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });

      await inbox.cancel(task.id);

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.CANCELLED);
    });
  });

  describe('Human-in-the-loop', () => {
    it('should suspend a task', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');
      await inbox.startTask(task.id);

      await inbox.suspend(task.id, {
        reason: 'Need user approval',
        payload: { question: 'Approve this action?' },
      });

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.WAITING_FOR_INPUT);
      expect(updated!.suspendedAt).toBeDefined();
      expect(updated!.suspendPayload).toEqual({
        reason: 'Need user approval',
        payload: { question: 'Approve this action?' },
      });
    });

    it('should resume a suspended task', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });
      await inbox.claim('agent-1');
      await inbox.startTask(task.id);
      await inbox.suspend(task.id, { reason: 'Need input' });

      await inbox.resume(task.id, { payload: { approved: true } });

      const updated = await inbox.get(task.id);
      expect(updated!.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updated!.resumePayload).toEqual({ approved: true });
    });

    it('should list waiting tasks', async () => {
      const task1 = await inbox.add({ type: 'test1', payload: {} });
      const task2 = await inbox.add({ type: 'test2', payload: {} });
      await inbox.add({ type: 'test3', payload: {} });

      await inbox.claim('agent-1');
      await inbox.startTask(task1.id);
      await inbox.suspend(task1.id, { reason: 'Need input 1' });

      await inbox.claim('agent-1');
      await inbox.startTask(task2.id);
      await inbox.suspend(task2.id, { reason: 'Need input 2' });

      const waiting = await inbox.listWaiting();
      expect(waiting).toHaveLength(2);
    });
  });

  describe('Query API', () => {
    it('should get a task by ID', async () => {
      const created = await inbox.add({ type: 'test', payload: { foo: 'bar' } });

      const retrieved = await inbox.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.payload).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent task', async () => {
      const retrieved = await inbox.get('non-existent-id');
      expect(retrieved).toBeNull();
    });

    it('should list tasks with filters', async () => {
      const task1 = await inbox.add({ type: 'bug', payload: {} });
      await inbox.add({ type: 'feature', payload: {} });
      await inbox.add({ type: 'bug', payload: {} });

      // Complete one task (the first bug)
      await inbox.claim('agent-1');
      await inbox.startTask(task1.id);
      await inbox.complete(task1.id, {});

      // Now we have: 1 completed bug, 1 pending feature, 1 pending bug
      const pending = await inbox.list({ status: TaskStatus.PENDING });
      expect(pending).toHaveLength(2);

      const bugs = await inbox.list({ type: 'bug' });
      expect(bugs).toHaveLength(2); // Both bugs (1 completed, 1 pending)

      const completedBugs = await inbox.list({ type: 'bug', status: TaskStatus.COMPLETED });
      expect(completedBugs).toHaveLength(1);
    });

    it('should get inbox stats', async () => {
      const task1 = await inbox.add({ type: 'test1', payload: {} });
      await inbox.add({ type: 'test2', payload: {} });
      await inbox.add({ type: 'test3', payload: {} });

      // Complete task1
      await inbox.claim('agent-1');
      await inbox.startTask(task1.id);
      await inbox.complete(task1.id, {});

      const stats = await inbox.stats();

      // task1 is completed, task2 and task3 are pending
      expect(stats.pending).toBe(2);
      expect(stats.completed).toBe(1);
    });
  });

  describe('Task targeting', () => {
    it('should respect targetAgentId when claiming', async () => {
      await inbox.add({ type: 'test', payload: {}, targetAgentId: 'agent-1' });
      await inbox.add({ type: 'test', payload: {}, targetAgentId: 'agent-2' });

      const claimedByAgent1 = await inbox.claim('agent-1');
      const claimedByAgent2 = await inbox.claim('agent-2');

      expect(claimedByAgent1!.targetAgentId).toBe('agent-1');
      expect(claimedByAgent2!.targetAgentId).toBe('agent-2');

      // Agent-1 shouldn't be able to claim agent-2's task
      const another = await inbox.claim('agent-1');
      expect(another).toBeNull();
    });
  });

  describe('Update API', () => {
    it('should update task runId', async () => {
      const task = await inbox.add({ type: 'test', payload: {} });

      const updated = await inbox.updateTask(task.id, { runId: 'run-123' });

      expect(updated.runId).toBe('run-123');
    });

    it('should update task metadata', async () => {
      const task = await inbox.add({
        type: 'test',
        payload: {},
        metadata: { existing: 'value' },
      });

      const updated = await inbox.updateTask(task.id, {
        metadata: { new: 'data' },
      });

      expect(updated.metadata).toEqual({
        existing: 'value',
        new: 'data',
      });
    });
  });
});
