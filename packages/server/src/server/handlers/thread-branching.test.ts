import {
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY,
  MASTRA_THREAD_BRANCH_STATE_METADATA_KEY,
} from '@mastra/core/memory';
import type { MastraMemory } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { authorizeMemoryThreadForOMRead, sanitizeThreadForResponse } from './thread-branching';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

describe('sanitizeThreadForResponse', () => {
  it('removes every framework-owned branch key and keeps user metadata', () => {
    const thread = sanitizeThreadForResponse({
      id: 'child',
      resourceId: 'resource',
      createdAt,
      updatedAt: createdAt,
      metadata: {
        topic: 'kept',
        [MASTRA_THREAD_BRANCH_METADATA_KEY]: { parentThreadId: 'root', state: 'ready' },
        [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: 'root',
        [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: 'ready',
      },
    });

    expect(thread.metadata).toEqual({ topic: 'kept' });
  });
});

describe('authorizeMemoryThreadForOMRead', () => {
  it('runs FGA for a thread id that has no row yet, like the pre-branch OM handler', async () => {
    const require = vi.fn().mockRejectedValue(Object.assign(new Error('FGA denied'), { status: 403 }));
    const mastra = { getServer: () => ({ fga: { require } }) };
    const requestContext = new RequestContext();
    const user = { id: 'user-1' };
    requestContext.set('user', user);
    const memory = { getThreadById: vi.fn().mockResolvedValue(null) } as unknown as MastraMemory;

    await expect(
      authorizeMemoryThreadForOMRead({
        mastra,
        requestContext,
        memory,
        threadId: 'missing-thread',
        effectiveResourceId: 'other-resource',
      }),
    ).rejects.toMatchObject({ status: 403, message: 'FGA denied' });
    expect(require).toHaveBeenCalledWith(user, {
      resource: { type: 'thread', id: 'missing-thread' },
      permission: 'memory:read',
      context: expect.objectContaining({ resourceId: 'other-resource' }),
    });
  });

  it('still lets an absent thread through when FGA allows it', async () => {
    const memory = { getThreadById: vi.fn().mockResolvedValue(null) } as unknown as MastraMemory;
    await expect(
      authorizeMemoryThreadForOMRead({ mastra: {}, memory, threadId: 'new-thread', effectiveResourceId: 'r1' }),
    ).resolves.toBeUndefined();
  });
});
