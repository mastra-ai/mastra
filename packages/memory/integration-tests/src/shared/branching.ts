import type { MastraDBMessage } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface BranchingTestContext {
  memory: Memory;
  cleanup?: () => Promise<void>;
}

const baseTime = new Date('2026-03-01T00:00:00.000Z');

function message(id: string, threadId: string, resourceId: string, offset = 0): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: id }] },
    createdAt: new Date(baseTime.getTime() + offset),
  };
}

export function getBranchingTests(name: string, createContext: () => Promise<BranchingTestContext>): void {
  describe(`shared-history branching contract (${name})`, () => {
    let context: BranchingTestContext;

    beforeEach(async () => {
      context = await createContext();
    });

    afterEach(async () => {
      await context.memory.settled();
      await context.cleanup?.();
    });

    it('resolves an oversized equal-timestamp cohort without parent or sibling leakage', async () => {
      const resourceId = `branch-contract-${name}`;
      const tied = Array.from({ length: 150 }, (_, index) =>
        message(`root-${String(index).padStart(3, '0')}`, 'root', resourceId),
      );
      await context.memory.createThread({ threadId: 'root', resourceId });
      await context.memory.saveMessages({ messages: tied });

      const branch = await context.memory.branchThread({
        threadId: 'root',
        branchPointMessageId: 'root-120',
      });
      const sibling = await context.memory.branchThread({
        threadId: 'root',
        branchPointMessageId: 'root-030',
      });
      await context.memory.saveMessages({
        messages: [
          message('parent-post-fork-sentinel', 'root', resourceId, 1),
          message('branch-tail', branch.thread.id, resourceId, 2),
          message('sibling-tail-sentinel', sibling.thread.id, resourceId, 3),
        ],
      });

      const recalled = await context.memory.recall({
        threadId: branch.thread.id,
        resourceId,
        perPage: 10,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
      const ids = recalled.messages.map(item => item.id);

      expect(ids).toEqual([
        'root-120',
        'root-119',
        'root-118',
        'root-117',
        'root-116',
        'root-115',
        'root-114',
        'root-113',
        'root-112',
        'branch-tail',
      ]);
      expect(ids).not.toContain('parent-post-fork-sentinel');
      expect(ids).not.toContain('sibling-tail-sentinel');
    });

    it('finds and paginates more than one adapter page of direct branches sharing a tied fork', async () => {
      const resourceId = `branch-scan-${name}`;
      await context.memory.createThread({ threadId: 'root', resourceId });
      await context.memory.saveMessages({ messages: [message('fork', 'root', resourceId)] });

      for (let index = 0; index < 105; index += 1) {
        await context.memory.branchThread({ threadId: 'root', branchPointMessageId: 'fork' });
      }

      const firstPage = await context.memory.listBranches({ threadId: 'root', page: 0, perPage: 100 });
      const secondPage = await context.memory.listBranches({ threadId: 'root', page: 1, perPage: 100 });
      const allBranches = await context.memory.listBranches({ threadId: 'root', perPage: false });

      expect(firstPage).toMatchObject({ total: 105, hasMore: true });
      expect(firstPage.branches).toHaveLength(100);
      expect(secondPage).toMatchObject({ total: 105, hasMore: false });
      expect(secondPage.branches).toHaveLength(5);
      expect(allBranches.branches).toHaveLength(105);
      expect(new Set(allBranches.branches.map(branch => branch.thread.id))).toHaveLength(105);
      expect(allBranches.branches.every(branch => branch.branch.branchPointMessageId === 'fork')).toBe(true);
    });
  });
}
