import type { MastraStorage, InboxStorage } from '@mastra/core/storage';
import { TaskStatus } from '@mastra/core';
import { describe, it, expect, beforeAll } from 'vitest';

export function createStatsTest({ storage }: { storage: MastraStorage }) {
  let inboxStorage: InboxStorage;

  beforeAll(async () => {
    const store = await storage.getStore('inbox');
    if (!store) {
      throw new Error('Inbox storage not found');
    }
    inboxStorage = store;
  });

  describe('Inbox statistics', () => {
    const inboxId = 'test-inbox-stats';
    const agentId = 'stats-agent';

    it('should return inbox stats', async () => {
      // Create tasks in various states
      const pending = await inboxStorage.createTask(inboxId, {
        type: 'stats-test',
        payload: { state: 'pending' },
      });

      const toComplete = await inboxStorage.createTask(inboxId, {
        type: 'stats-test',
        payload: { state: 'completed' },
      });

      const toFail = await inboxStorage.createTask(inboxId, {
        type: 'stats-test',
        payload: { state: 'failed' },
        maxAttempts: 1,
      });

      // Complete one
      await inboxStorage.claimTask({ inboxId, agentId });
      await inboxStorage.startTask(toComplete.id);
      await inboxStorage.completeTask(toComplete.id, { done: true });

      // Fail one
      const claimed = await inboxStorage.claimTask({ inboxId, agentId });
      if (claimed) {
        await inboxStorage.startTask(claimed.id);
        await inboxStorage.failTask({
          taskId: claimed.id,
          error: { message: 'Test failure' },
          retryConfig: { maxAttempts: 1, baseDelay: 1000, maxDelay: 60000, multiplier: 2, jitter: false },
        });
      }

      const stats = await inboxStorage.getStats(inboxId);

      expect(stats).toBeDefined();
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.claimed).toBe('number');
      expect(typeof stats.inProgress).toBe('number');
      expect(typeof stats.waitingForInput).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');

      // At least one completed
      expect(stats.completed).toBeGreaterThanOrEqual(1);
    });

    it('should return zero stats for empty inbox', async () => {
      const stats = await inboxStorage.getStats('empty-stats-inbox');

      expect(stats.pending).toBe(0);
      expect(stats.claimed).toBe(0);
      expect(stats.inProgress).toBe(0);
      expect(stats.waitingForInput).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });
}
