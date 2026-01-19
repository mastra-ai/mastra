import type { MastraStorage, InboxStorage } from '@mastra/core/storage';
import { TaskStatus, TaskPriority } from '@mastra/core';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

export function createTasksTest({ storage }: { storage: MastraStorage }) {
  let inboxStorage: InboxStorage;

  beforeAll(async () => {
    const store = await storage.getStore('inbox');
    if (!store) {
      throw new Error('Inbox storage not found');
    }
    inboxStorage = store;
  });

  describe('Task CRUD operations', () => {
    const inboxId = 'test-inbox-crud';

    it('should create a task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'test-task',
        payload: { message: 'Hello world' },
        priority: TaskPriority.NORMAL,
        title: 'Test Task',
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.inboxId).toBe(inboxId);
      expect(task.type).toBe('test-task');
      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.payload).toEqual({ message: 'Hello world' });
      expect(task.title).toBe('Test Task');
      expect(task.priority).toBe(TaskPriority.NORMAL);
    });

    it('should create a task with high priority', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'urgent-task',
        payload: { urgent: true },
        priority: TaskPriority.URGENT,
      });

      expect(task.priority).toBe(TaskPriority.URGENT);
    });

    it('should create a task with targetAgentId', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'targeted-task',
        payload: {},
        targetAgentId: 'specific-agent',
      });

      expect(task.targetAgentId).toBe('specific-agent');
    });

    it('should create a task with sourceId and sourceUrl', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'external-task',
        payload: {},
        sourceId: 'github-123',
        sourceUrl: 'https://github.com/owner/repo/issues/123',
      });

      expect(task.sourceId).toBe('github-123');
      expect(task.sourceUrl).toBe('https://github.com/owner/repo/issues/123');
    });

    it('should get a task by ID', async () => {
      const created = await inboxStorage.createTask(inboxId, {
        type: 'get-test',
        payload: { data: 'value' },
      });

      const retrieved = await inboxStorage.getTaskById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.payload).toEqual({ data: 'value' });
    });

    it('should return null for non-existent task', async () => {
      const result = await inboxStorage.getTaskById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should update a task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'update-test',
        payload: {},
      });

      const updated = await inboxStorage.updateTask(task.id, {
        runId: 'run-123',
        metadata: { key: 'value' },
      });

      expect(updated.runId).toBe('run-123');
      expect(updated.metadata).toEqual({ key: 'value' });
    });

    it('should upsert a task (create)', async () => {
      const task = await inboxStorage.upsertTask(inboxId, 'new-source-id', {
        type: 'upsert-test',
        payload: { version: 1 },
        title: 'Original Title',
      });

      expect(task.sourceId).toBe('new-source-id');
      expect(task.title).toBe('Original Title');
    });

    it('should upsert a task (update existing)', async () => {
      // First create
      const created = await inboxStorage.upsertTask(inboxId, 'upsert-source', {
        type: 'upsert-test',
        payload: { version: 1 },
        title: 'Original',
      });

      // Then upsert with same sourceId
      const updated = await inboxStorage.upsertTask(inboxId, 'upsert-source', {
        type: 'upsert-test',
        payload: { version: 2 },
        title: 'Updated',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('Updated');
      expect(updated.payload).toEqual({ version: 2 });
    });
  });

  describe('Task listing', () => {
    const inboxId = 'test-inbox-list';

    beforeEach(async () => {
      // Create some test tasks
      await inboxStorage.createTask(inboxId, {
        type: 'type-a',
        payload: {},
        priority: TaskPriority.HIGH,
      });
      await inboxStorage.createTask(inboxId, {
        type: 'type-b',
        payload: {},
        priority: TaskPriority.LOW,
      });
      await inboxStorage.createTask(inboxId, {
        type: 'type-a',
        payload: {},
        priority: TaskPriority.NORMAL,
      });
    });

    it('should list all tasks for an inbox', async () => {
      const tasks = await inboxStorage.listTasks(inboxId, {});
      expect(tasks.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter tasks by type', async () => {
      const tasks = await inboxStorage.listTasks(inboxId, { type: 'type-a' });
      expect(tasks.every(t => t.type === 'type-a')).toBe(true);
    });

    it('should filter tasks by status', async () => {
      const tasks = await inboxStorage.listTasks(inboxId, { status: TaskStatus.PENDING });
      expect(tasks.every(t => t.status === TaskStatus.PENDING)).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const tasks = await inboxStorage.listTasks(inboxId, { priority: TaskPriority.HIGH });
      expect(tasks.every(t => t.priority === TaskPriority.HIGH)).toBe(true);
    });

    it('should respect limit', async () => {
      const tasks = await inboxStorage.listTasks(inboxId, { limit: 2 });
      expect(tasks.length).toBeLessThanOrEqual(2);
    });

    it('should respect offset', async () => {
      const allTasks = await inboxStorage.listTasks(inboxId, {});
      const offsetTasks = await inboxStorage.listTasks(inboxId, { offset: 1 });

      if (allTasks.length > 1) {
        expect(offsetTasks.length).toBe(allTasks.length - 1);
      }
    });
  });
}
