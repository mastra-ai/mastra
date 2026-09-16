import { describe, expect, it } from 'vitest';

import { queryKeys } from '../api/keys';
import { createQueryClient } from '../query-client';
import type { FactoryUserSession } from '../ui/domains/workspaces/services/user-sessions';
import { sessionsRefetchInterval, updateCachedSessionTitle } from './useWorkspaces';
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

describe('updateCachedSessionTitle', () => {
  it('updates the matching workspace without replacing unrelated rows', async () => {
    const client = createQueryClient();
    const workspace = session({ title: undefined });
    const unrelated = session({ id: 'row-2', sessionId: 'sess-2', title: 'Keep me' });
    const current = data({ workspaces: [workspace, unrelated] });
    const queryKey = queryKeys.sessions(workspace.projectRepositoryId);
    client.setQueryData(queryKey, current);

    await updateCachedSessionTitle(
      client,
      workspace.projectRepositoryId,
      workspace.sessionId,
      'Generated workspace title',
    );

    const updated = client.getQueryData<WorkspacesData>(queryKey);
    expect(updated).toEqual(
      data({
        workspaces: [{ ...workspace, title: 'Generated workspace title' }, unrelated],
      }),
    );
    expect(updated?.workspaces[1]).toBe(unrelated);
  });

  it('updates the matching user session', async () => {
    const client = createQueryClient();
    const userSession = session({ sessionId: 'user-1', title: undefined, branch: 'user/session-user-1' });
    const queryKey = queryKeys.sessions(userSession.projectRepositoryId);
    client.setQueryData(queryKey, data({ userSessions: [userSession] }));

    await updateCachedSessionTitle(
      client,
      userSession.projectRepositoryId,
      userSession.sessionId,
      'Generated user title',
    );

    expect(client.getQueryData<WorkspacesData>(queryKey)?.userSessions).toEqual([
      { ...userSession, title: 'Generated user title' },
    ]);
  });

  it('keeps the title when a canceled sessions fetch resolves with stale data', async () => {
    const client = createQueryClient();
    const workspace = session({ title: undefined });
    const current = data({ workspaces: [workspace] });
    const queryKey = queryKeys.sessions(workspace.projectRepositoryId);
    client.setQueryData(queryKey, current);

    let resolveFetch!: (value: WorkspacesData) => void;
    const fetch = client.fetchQuery({
      queryKey,
      queryFn: () =>
        new Promise<WorkspacesData>(resolve => {
          resolveFetch = resolve;
        }),
      staleTime: 0,
    });
    const fetchResult = fetch.catch(() => undefined);
    await Promise.resolve();
    expect(client.getQueryState(queryKey)?.fetchStatus).toBe('fetching');

    await updateCachedSessionTitle(
      client,
      workspace.projectRepositoryId,
      workspace.sessionId,
      'Generated workspace title',
    );
    resolveFetch(current);
    await fetchResult;

    expect(client.getQueryData<WorkspacesData>(queryKey)?.workspaces).toEqual([
      { ...workspace, title: 'Generated workspace title' },
    ]);
  });

  it('preserves the cached data when the session is absent or the title is unchanged', async () => {
    const client = createQueryClient();
    const workspace = session({ title: 'Generated workspace title' });
    const current = data({ workspaces: [workspace] });
    const queryKey = queryKeys.sessions(workspace.projectRepositoryId);
    client.setQueryData(queryKey, current);

    await updateCachedSessionTitle(client, workspace.projectRepositoryId, 'missing-session', 'Other title');
    expect(client.getQueryData(queryKey)).toBe(current);

    await updateCachedSessionTitle(
      client,
      workspace.projectRepositoryId,
      workspace.sessionId,
      'Generated workspace title',
    );
    expect(client.getQueryData(queryKey)).toBe(current);
  });
});
