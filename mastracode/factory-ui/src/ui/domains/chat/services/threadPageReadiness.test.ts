import { describe, expect, it, vi } from 'vitest';

import { adoptThreadPageKickoffEchoes, claimThreadPageKickoffs, queueThreadPageKickoff } from './threadPageReadiness';

const key = { resourceId: 'resource-a', projectPath: '/worktree/a', threadId: 'thread-a' };

describe('thread page kickoff', () => {
  it('hands the kickoff to the exact scoped thread and resolves after dispatch completes', async () => {
    const completed = queueThreadPageKickoff(key, 'hello', { timeoutMs: 100 });

    const [kickoff] = claimThreadPageKickoffs(key);

    expect(kickoff?.message).toBe('hello');
    kickoff?.complete();
    await expect(completed).resolves.toBeUndefined();
    expect(claimThreadPageKickoffs(key)).toEqual([]);
  });

  it('rejects when dispatch fails after the page claims the kickoff', async () => {
    const completed = queueThreadPageKickoff(key, 'hello', { timeoutMs: 100 });
    const [kickoff] = claimThreadPageKickoffs(key);

    kickoff?.fail(new Error('dispatch failed'));

    await expect(completed).rejects.toThrow('dispatch failed');
  });

  it('does not expose a kickoff to another resource or project scope', async () => {
    const completed = queueThreadPageKickoff(key, 'hello', { timeoutMs: 10 });

    expect(claimThreadPageKickoffs({ ...key, resourceId: 'resource-b' })).toEqual([]);
    expect(claimThreadPageKickoffs({ ...key, projectPath: '/worktree/b' })).toEqual([]);

    await expect(completed).rejects.toThrow('Timed out waiting for thread thread-a to complete its kickoff');
  });

  it('disarms the preparation timeout at claim so a slow dispatch cannot be misreported as never coming online', async () => {
    vi.useFakeTimers();
    try {
      const completed = queueThreadPageKickoff(key, 'hello', { timeoutMs: 10 });
      const [kickoff] = claimThreadPageKickoffs(key);

      await vi.advanceTimersByTimeAsync(50);
      kickoff?.complete();

      await expect(completed).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-echoes queued messages to a new transcript instance but never twice to the same one', async () => {
    const first = queueThreadPageKickoff(key, 'shown', { echoOwner: 'transcript-1', timeoutMs: 100 });
    const second = queueThreadPageKickoff(key, 'unshown', { timeoutMs: 100 });

    expect(adoptThreadPageKickoffEchoes(key, 'transcript-1')).toEqual(['unshown']);
    expect(adoptThreadPageKickoffEchoes(key, 'transcript-1')).toEqual([]);
    expect(adoptThreadPageKickoffEchoes(key, 'transcript-2')).toEqual(['shown', 'unshown']);

    const kickoffs = claimThreadPageKickoffs(key);
    kickoffs.forEach(kickoff => kickoff.complete());
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
  });

  it('queues concurrent kickoffs for the same thread in order', async () => {
    const firstCompleted = queueThreadPageKickoff(key, 'first', { timeoutMs: 100 });
    const secondCompleted = queueThreadPageKickoff(key, 'second', { timeoutMs: 100 });

    const kickoffs = claimThreadPageKickoffs(key);
    expect(kickoffs.map(kickoff => kickoff.message)).toEqual(['first', 'second']);
    expect(claimThreadPageKickoffs(key)).toEqual([]);
    kickoffs.forEach(kickoff => kickoff.complete());
    await expect(Promise.all([firstCompleted, secondCompleted])).resolves.toEqual([undefined, undefined]);
  });
});
