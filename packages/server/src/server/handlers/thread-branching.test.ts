import {
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY,
  MASTRA_THREAD_BRANCH_STATE_METADATA_KEY,
} from '@mastra/core/memory';
import { describe, expect, it } from 'vitest';
import { sanitizeThreadForResponse } from './thread-branching';

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
