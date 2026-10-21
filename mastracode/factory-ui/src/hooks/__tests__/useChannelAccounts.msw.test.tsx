import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryUserSession } from '../../ui/domains/workspaces/services/user-sessions';
import { useDisconnectChannelAccountMutation } from '../useChannelAccounts';
import { useUserSessionQuery, useWorkspacesQuery } from '../useWorkspaces';

describe('disconnecting a linked account', () => {
  it('refreshes names in cached session lists and individual sessions', async () => {
    let linked = true;
    const session: FactoryUserSession = {
      id: 'row-1',
      sessionId: 'session-1',
      projectRepositoryId: 'repo-1',
      orgId: 'org-1',
      userId: 'owner-1',
      visibility: 'org',
      branch: 'user/session-1',
      baseBranch: 'main',
      sandboxId: null,
      sandboxWorkdir: null,
      materializedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const current = () => ({ ...session, ...(linked ? { owner: { id: 'owner-1', name: 'Grace Hopper' } } : {}) });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/sessions`, () =>
        HttpResponse.json({ sessions: [current()] }),
      ),
      http.get(`${TEST_BASE_URL}/web/user-sessions/session-1`, () => HttpResponse.json({ session: current() })),
      http.delete(`${TEST_BASE_URL}/web/channel-accounts`, () => {
        linked = false;
        return HttpResponse.json({ deleted: true });
      }),
    );
    const { result } = renderHookWithProviders(() => ({
      list: useWorkspacesQuery('fp-1'),
      detail: useUserSessionQuery('session-1'),
      disconnect: useDisconnectChannelAccountMutation(),
    }));
    await waitFor(() => {
      expect(result.current.list.data?.userSessions[0]?.owner?.name).toBe('Grace Hopper');
      expect(result.current.detail.data?.owner?.name).toBe('Grace Hopper');
    });
    await act(async () => {
      await result.current.disconnect.mutateAsync({ platform: 'slack', externalTeamId: 'T-1', externalUserId: 'U-1' });
    });
    await waitFor(() => {
      expect(result.current.list.data?.userSessions[0]).toEqual(session);
      expect(result.current.detail.data).toEqual(session);
    });
  });
});
