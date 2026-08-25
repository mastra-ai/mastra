import { describe, expect, it } from 'vitest';

import type { FactoryUserSession } from '../ui/domains/workspaces/services/user-sessions';
import { sessionsRefetchInterval } from './useWorkspaces';
import type { WorkspacesData } from './useWorkspaces';

function session(overrides: Partial<FactoryUserSession>): FactoryUserSession {
  return {
    id: 'row-1',
    sessionId: 'sess-1',
    projectRepositoryId: 'ghp-1',
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title: 'Session',
    branch: 'factory/issue-1',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: '2026-07-20T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function data(overrides: Partial<WorkspacesData>): WorkspacesData {
  return { workspaces: [], userSessions: [], ...overrides };
}

// Five minutes after the fixture's `updatedAt` — inside the poll window.
const NOW = Date.parse('2026-07-20T00:05:00.000Z');

describe('sessionsRefetchInterval', () => {
  it('does not poll before the list has loaded', () => {
    expect(sessionsRefetchInterval(undefined, NOW)).toBe(false);
  });

  it('does not poll when every session is materialized', () => {
    expect(
      sessionsRefetchInterval(
        data({ workspaces: [session({})], userSessions: [session({ sessionId: 'sess-2' })] }),
        NOW,
      ),
    ).toBe(false);
  });

  it('polls while a workspace session is un-materialized', () => {
    expect(sessionsRefetchInterval(data({ workspaces: [session({ materializedAt: null })] }), NOW)).toBe(15_000);
  });

  it('polls while a user session is un-materialized', () => {
    expect(sessionsRefetchInterval(data({ userSessions: [session({ materializedAt: null })] }), NOW)).toBe(15_000);
  });

  it('stops polling once an un-materialized session has had no activity for the window', () => {
    const afterWindow = Date.parse('2026-07-20T00:10:00.000Z');
    expect(sessionsRefetchInterval(data({ workspaces: [session({ materializedAt: null })] }), afterWindow)).toBe(false);
  });
});
