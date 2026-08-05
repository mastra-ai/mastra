import { beforeEach, describe, expect, it } from 'vitest';

import { SourceControlStorageInMemory } from '../../storage/domains/source-control/inmemory.js';
import { allocateUserSessionBranch } from './user-session-names.js';

describe('allocateUserSessionBranch', () => {
  let sourceControl: SourceControlStorageInMemory;

  beforeEach(() => {
    sourceControl = new SourceControlStorageInMemory();
  });

  const allocate = () =>
    allocateUserSessionBranch({ sourceControl, projectRepositoryId: 'ghp-1', userId: 'user-1' });

  const createSession = (branch: string) =>
    sourceControl.sessions.create({
      sessionId: `sess-${branch}`,
      projectRepositoryId: 'ghp-1',
      orgId: 'org-1',
      userId: 'user-1',
      branch,
      baseBranch: 'main',
    });

  it('starts at one', async () => {
    expect(await allocate()).toBe('user/session-1');
  });

  it('counts past names already in use, including ones it never handed out', async () => {
    await createSession('user/session-1');
    await createSession('user/session-4');

    expect(await allocate()).toBe('user/session-5');
  });

  it('does not come back around after the highest session is deleted', async () => {
    await createSession('user/session-1');
    expect(await allocate()).toBe('user/session-2');
    const created = await createSession('user/session-2');

    await sourceControl.sessions.delete(created.id);

    // The deleted session's branch outlives its row, and create is idempotent
    // per branch — handing out 2 again would reopen its work.
    expect(await allocate()).toBe('user/session-3');
  });

  it('ignores branches that are not generated names', async () => {
    await createSession('user/login-bug');
    await createSession('factory/pr-900');

    expect(await allocate()).toBe('user/session-1');
  });

  it('names each user their own sessions', async () => {
    await createSession('user/session-1');
    await allocate();

    expect(
      await allocateUserSessionBranch({ sourceControl, projectRepositoryId: 'ghp-1', userId: 'user-2' }),
    ).toBe('user/session-1');
  });
});
