import type { MastraStorage, InboxStorage } from '@mastra/core/storage';
import { TaskStatus } from '@mastra/core';
import { describe, it, expect, beforeAll } from 'vitest';

export function createSuspendTest({ storage }: { storage: MastraStorage }) {
  let inboxStorage: InboxStorage;

  beforeAll(async () => {
    const store = await storage.getStore('inbox');
    if (!store) {
      throw new Error('Inbox storage not found');
    }
    inboxStorage = store;
  });

  describe('Task suspend/resume (human-in-the-loop)', () => {
    const inboxId = 'test-inbox-suspend';
    const agentId = 'suspend-agent';

    it('should suspend a task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'suspend-test',
        payload: {},
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(task.id);
      await inboxStorage.suspendTask(task.id, {
        reason: 'Waiting for user approval',
        payload: { question: 'Do you approve?' },
      });

      const suspended = await inboxStorage.getTaskById(task.id);
      expect(suspended?.status).toBe(TaskStatus.WAITING_FOR_INPUT);
      expect(suspended?.suspendedAt).toBeDefined();
      expect(suspended?.suspendPayload).toEqual({ question: 'Do you approve?' });
    });

    it('should resume a suspended task', async () => {
      const task = await inboxStorage.createTask(inboxId, {
        type: 'resume-test',
        payload: {},
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(task.id);
      await inboxStorage.suspendTask(task.id, {
        reason: 'Need input',
        payload: {},
      });

      await inboxStorage.resumeTask(task.id, {
        payload: { userResponse: 'approved' },
      });

      const resumed = await inboxStorage.getTaskById(task.id);
      expect(resumed?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(resumed?.resumePayload).toEqual({ userResponse: 'approved' });
    });

    it('should list waiting tasks', async () => {
      // Create and suspend a task
      const task = await inboxStorage.createTask(inboxId, {
        type: 'waiting-list-test',
        payload: {},
      });

      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(task.id);
      await inboxStorage.suspendTask(task.id, {
        reason: 'Waiting',
        payload: {},
      });

      const waiting = await inboxStorage.listWaitingTasks(inboxId);
      expect(waiting.some(t => t.id === task.id)).toBe(true);
      expect(waiting.every(t => t.status === TaskStatus.WAITING_FOR_INPUT)).toBe(true);
    });
  });
}
