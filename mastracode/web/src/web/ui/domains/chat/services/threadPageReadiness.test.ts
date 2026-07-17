import { describe, expect, it } from 'vitest';

import { claimThreadPageKickoffs, queueThreadPageKickoff } from './threadPageReadiness';

const key = { resourceId: 'resource-a', projectPath: '/worktree/a', threadId: 'thread-a' };

describe('thread page kickoff', () => {
  it('hands the kickoff to the exact scoped thread and resolves when accepted', async () => {
    const accepted = queueThreadPageKickoff(key, 'hello', 100);

    const [kickoff] = claimThreadPageKickoffs(key);

    expect(kickoff?.message).toBe('hello');
    kickoff?.accept();
    await expect(accepted).resolves.toBeUndefined();
    expect(claimThreadPageKickoffs(key)).toEqual([]);
  });

  it('does not expose a kickoff to another resource or project scope', async () => {
    const accepted = queueThreadPageKickoff(key, 'hello', 10);

    expect(claimThreadPageKickoffs({ ...key, resourceId: 'resource-b' })).toEqual([]);
    expect(claimThreadPageKickoffs({ ...key, projectPath: '/worktree/b' })).toEqual([]);

    await expect(accepted).rejects.toThrow('Timed out waiting for thread thread-a to accept its kickoff');
  });

  it('queues concurrent kickoffs for the same thread in order', async () => {
    const firstAccepted = queueThreadPageKickoff(key, 'first', 100);
    const secondAccepted = queueThreadPageKickoff(key, 'second', 100);

    const kickoffs = claimThreadPageKickoffs(key);
    expect(kickoffs.map(kickoff => kickoff.message)).toEqual(['first', 'second']);
    expect(claimThreadPageKickoffs(key)).toEqual([]);
    kickoffs.forEach(kickoff => kickoff.accept());
    await expect(Promise.all([firstAccepted, secondAccepted])).resolves.toEqual([undefined, undefined]);
  });
});
