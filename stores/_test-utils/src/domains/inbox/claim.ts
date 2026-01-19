import type { MastraStorage, InboxStorage } from '@mastra/core/storage';
import { TaskStatus, TaskPriority } from '@mastra/core';
import { describe, it, expect, beforeAll } from 'vitest';

export function createClaimTest({ storage }: { storage: MastraStorage }) {
  let inboxStorage: InboxStorage;

  beforeAll(async () => {
    const store = await storage.getStore('inbox');
    if (!store) {
      throw new Error('Inbox storage not found');
    }
    inboxStorage = store;
  });

  describe('Task claiming', () => {
    const inboxId = 'test-inbox-claim';
    const agentId = 'test-agent';

    it('should claim a pending task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'claim-test',
        payload: {},
      });

      const claimed = await inboxStorage.claimTask({ inboxId, agentId });

      expect(claimed).toBeDefined();
      expect(claimed?.status).toBe(TaskStatus.CLAIMED);
      expect(claimed?.claimedBy).toBe(agentId);
      expect(claimed?.claimedAt).toBeDefined();
    });

    it('should claim tasks in priority order (high first)', async () => {
      // Create low priority first
      await inboxStorage.createTask(inboxId, {
        type: 'priority-test',
        payload: { priority: 'low' },
        priority: TaskPriority.LOW,
      });

      // Create high priority second
      await inboxStorage.createTask(inboxId, {
        type: 'priority-test',
        payload: { priority: 'high' },
        priority: TaskPriority.HIGH,
      });

      // Should claim high priority first
      const claimed = await inboxStorage.claimTask({
        inboxId,
        agentId,
        filter: { types: ['priority-test'] },
      });

      expect(claimed).toBeDefined();
      expect(claimed?.priority).toBe(TaskPriority.HIGH);
    });

    it('should filter by task types when claiming', async () => {
      await inboxStorage.createTask(inboxId, {
        type: 'wanted-type',
        payload: {},
      });

      await inboxStorage.createTask(inboxId, {
        type: 'unwanted-type',
        payload: {},
      });

      const claimed = await inboxStorage.claimTask({
        inboxId,
        agentId,
        filter: { types: ['wanted-type'] },
      });

      expect(claimed).toBeDefined();
      expect(claimed?.type).toBe('wanted-type');
    });

    it('should respect targetAgentId when claiming', async () => {
      await inboxStorage.createTask(inboxId, {
        type: 'targeted',
        payload: {},
        targetAgentId: 'specific-agent',
      });

      // Different agent should not claim it
      const wrongAgent = await inboxStorage.claimTask({
        inboxId,
        agentId: 'other-agent',
        filter: { types: ['targeted'] },
      });
      expect(wrongAgent).toBeNull();

      // Correct agent should claim it
      const rightAgent = await inboxStorage.claimTask({
        inboxId,
        agentId: 'specific-agent',
        filter: { types: ['targeted'] },
      });
      expect(rightAgent).toBeDefined();
      expect(rightAgent?.targetAgentId).toBe('specific-agent');
    });

    it('should return null when no tasks available', async () => {
      const result = await inboxStorage.claimTask({ inboxId: 'empty-inbox', agentId });
      expect(result).toBeNull();
    });
  });

  describe('Task lifecycle', () => {
    const inboxId = 'test-inbox-lifecycle';
    const agentId = 'lifecycle-agent';

    it('should start a claimed task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'lifecycle-test',
        payload: {},
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(task.id);

      const started = await inboxStorage.getTaskById(task.id);
      expect(started?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(started?.startedAt).toBeDefined();
    });

    it('should complete a task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'complete-test',
        payload: {},
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(task.id);
      await inboxStorage.completeTask(task.id, { result: 'success' });

      const completed = await inboxStorage.getTaskById(task.id);
      expect(completed?.status).toBe(TaskStatus.COMPLETED);
      expect(completed?.result).toEqual({ result: 'success' });
      expect(completed?.completedAt).toBeDefined();
    });

    it('should fail a task (with retry)', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'fail-retry-test',
        payload: {},
        maxAttempts: 3,
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(task.id);
      await inboxStorage.failTask({
        taskId: task.id,
        error: { message: 'Network error: connection failed', retryable: true },
        retryConfig: { maxAttempts: 3, baseDelay: 1000, maxDelay: 60000, multiplier: 2, jitter: false },
      });

      const failed = await inboxStorage.getTaskById(task.id);
      // Should be pending for retry since it's a retryable error
      expect([TaskStatus.PENDING, TaskStatus.FAILED]).toContain(failed?.status);
      expect(failed?.attempts).toBe(1);
      expect(failed?.error?.message).toContain('connection failed');
    });

    it('should fail permanently after max attempts', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'fail-permanent-test',
        payload: {},
        maxAttempts: 1,
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(task.id);
      await inboxStorage.failTask({
        taskId: task.id,
        error: { message: 'Failed' },
        retryConfig: { maxAttempts: 1, baseDelay: 1000, maxDelay: 60000, multiplier: 2, jitter: false },
      });

      const failed = await inboxStorage.getTaskById(task.id);
      expect(failed?.status).toBe(TaskStatus.FAILED);
    });

    it('should release a claimed task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'release-test',
        payload: {},
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.releaseTask(task.id);

      const released = await inboxStorage.getTaskById(task.id);
      expect(released?.status).toBe(TaskStatus.PENDING);
      expect(released?.claimedBy).toBeUndefined();
    });

    it('should cancel a task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'cancel-test',
        payload: {},
      });

      await inboxStorage.cancelTask(task.id);

      const cancelled = await inboxStorage.getTaskById(task.id);
      expect(cancelled?.status).toBe(TaskStatus.CANCELLED);
    });
  });
}
