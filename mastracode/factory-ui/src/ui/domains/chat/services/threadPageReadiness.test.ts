import { describe, expect, it } from 'vitest';

import { claimThreadPageKickoffs, queueThreadPageKickoff } from './threadPageReadiness';

const key = { resourceId: 'resource-a', projectPath: '/worktree/a', threadId: 'thread-a' };

describe('thread page kickoff', () => {
  it('hands the kickoff to the exact scoped thread and resolves after dispatch completes', async () => {
    const completed = queueThreadPageKickoff(key, 'hello', 100);

    const [kickoff] = claimThreadPageKickoffs(key);

    expect(kickoff?.message).toBe('hello');
    kickoff?.complete();
    await expect(completed).resolves.toBeUndefined();
    expect(claimThreadPageKickoffs(key)).toEqual([]);
  });

  it('rejects when dispatch fails after the page claims the kickoff', async () => {
    const completed = queueThreadPageKickoff(key, 'hello', 100);
    const [kickoff] = claimThreadPageKickoffs(key);

    kickoff?.fail(new Error('dispatch failed'));

    await expect(completed).rejects.toThrow('dispatch failed');
  });

  it('does not expose a kickoff to another resource or project scope', async () => {
    const completed = queueThreadPageKickoff(key, 'hello', 10);

    expect(claimThreadPageKickoffs({ ...key, resourceId: 'resource-b' })).toEqual([]);
    expect(claimThreadPageKickoffs({ ...key, projectPath: '/worktree/b' })).toEqual([]);

    await expect(completed).rejects.toThrow('Timed out waiting for thread thread-a to complete its kickoff');
  });

  it('keeps the timeout active until a claimed kickoff completes', async () => {
    const completed = queueThreadPageKickoff(key, 'hello', 10);

    expect(claimThreadPageKickoffs(key)).toHaveLength(1);

    await expect(completed).rejects.toThrow('Timed out waiting for thread thread-a to complete its kickoff');
  });

  it('queues concurrent kickoffs for the same thread in order', async () => {
    const firstCompleted = queueThreadPageKickoff(key, 'first', 100);
    const secondCompleted = queueThreadPageKickoff(key, 'second', 100);

    const kickoffs = claimThreadPageKickoffs(key);
    expect(kickoffs.map(kickoff => kickoff.message)).toEqual(['first', 'second']);
    expect(claimThreadPageKickoffs(key)).toEqual([]);
    kickoffs.forEach(kickoff => kickoff.complete());
    await expect(Promise.all([firstCompleted, secondCompleted])).resolves.toEqual([undefined, undefined]);
  });
});
