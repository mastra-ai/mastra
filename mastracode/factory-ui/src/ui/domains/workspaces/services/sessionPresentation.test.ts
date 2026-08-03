import { describe, expect, it } from 'vitest';

import type { FactoryUserSession } from './github';
import { nextUserSessionName } from './sessionPresentation';

function session(branch: string): FactoryUserSession {
  return {
    id: `row-${branch}`,
    sessionId: `sess-${branch}`,
    projectRepositoryId: 'ghp-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

describe('nextUserSessionName', () => {
  it('starts at one', () => {
    expect(nextUserSessionName([])).toBe('session-1');
  });

  it('counts past the highest number in use rather than filling a gap', () => {
    const sessions = [session('user/session-1'), session('user/session-3')];

    expect(nextUserSessionName(sessions)).toBe('session-4');
  });

  it('ignores sessions the user named themselves', () => {
    const sessions = [session('user/session-2'), session('user/login-bug'), session('user/session-notes')];

    expect(nextUserSessionName(sessions)).toBe('session-3');
  });

  it('ignores factory sessions sharing the list', () => {
    expect(nextUserSessionName([session('factory/pr-900')])).toBe('session-1');
  });
});
