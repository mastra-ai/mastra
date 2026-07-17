import { describe, expect, it } from 'vitest';

import { markThreadPageReady, waitForThreadPageReady } from './threadPageReadiness';

const key = { resourceId: 'resource-a', projectPath: '/worktree/a', threadId: 'thread-a' };

describe('thread page readiness', () => {
  it('releases every waiter for the exact scoped thread', async () => {
    const first = waitForThreadPageReady(key, 100);
    const second = waitForThreadPageReady(key, 100);

    markThreadPageReady(key);

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  });

  it('does not release a waiter from another resource or project scope', async () => {
    const waiting = waitForThreadPageReady(key, 10);

    markThreadPageReady({ ...key, resourceId: 'resource-b' });
    markThreadPageReady({ ...key, projectPath: '/worktree/b' });

    await expect(waiting).rejects.toThrow('Timed out waiting for thread thread-a to become ready');
  });

  it('removes timed-out waiters so a later wait can resolve normally', async () => {
    await expect(waitForThreadPageReady(key, 1)).rejects.toThrow(
      'Timed out waiting for thread thread-a to become ready',
    );

    const next = waitForThreadPageReady(key, 100);
    markThreadPageReady(key);

    await expect(next).resolves.toBeUndefined();
  });
});
