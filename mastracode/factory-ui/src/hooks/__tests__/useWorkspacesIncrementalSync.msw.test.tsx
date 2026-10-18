/**
 * The sessions list is polled while sessions materialize and refetched on focus
 * and after every mutation. After the first read, each refetch asks only for the
 * sessions changed since the previous one and merges them into the cached list,
 * re-reading everything only when the merged list cannot match the server.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { createQueryClient } from '../../query-client';
import { allSessionRows, useWorkspacesQuery } from '../useWorkspaces';

const FACTORY_ID = 'fp-1';

function summary(index: number, overrides: { title?: string; updatedAt?: string; userId?: string } = {}) {
  return {
    id: `row-${index}`,
    sessionId: `session-${index}`,
    projectRepositoryId: 'repo-1',
    userId: overrides.userId ?? 'user-1',
    visibility: 'org' as const,
    title: overrides.title ?? null,
    branch: index % 2 === 0 ? `user/session-${index}` : `factory/issue-${index}`,
    baseBranch: 'main',
    materializedAt: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-10-01T10:00:00.000Z',
  };
}

const owners = { 'user-1': { name: 'Ada', avatarUrl: 'https://x/ada.png' }, 'user-2': { name: 'Grace' } };

/** Serves the full list, or the given delta when the client sends `updatedSince`. */
function stubSessionsList(responses: { full: () => object; delta: () => object }) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return HttpResponse.json(params.has('updatedSince') ? responses.delta() : responses.full());
    }),
  );
  return requests;
}

function titles(data: Parameters<typeof allSessionRows>[0]) {
  return allSessionRows(data).map(session => [session.sessionId, session.title ?? null, session.owner?.name ?? null]);
}

describe('useWorkspacesQuery incremental sync', () => {
  it('refetches only the sessions changed since the last read and merges them into the list', async () => {
    const requests = stubSessionsList({
      full: () => ({
        sessions: [summary(1), summary(2), summary(3)],
        owners: { 'user-1': owners['user-1'] },
        total: 3,
        syncedAt: '2026-10-01T10:05:00.000Z',
      }),
      delta: () => ({
        sessions: [
          summary(2, { title: 'Renamed', updatedAt: '2026-10-01T10:06:00.000Z' }),
          summary(4, { userId: 'user-2', updatedAt: '2026-10-01T10:06:00.000Z' }),
        ],
        owners: { 'user-1': owners['user-1'], 'user-2': owners['user-2'] },
        total: 4,
        syncedAt: '2026-10-01T10:07:00.000Z',
      }),
    });
    const client = createQueryClient();
    const { result } = renderHookWithProviders(() => useWorkspacesQuery(FACTORY_ID), { client });
    await waitFor(() => expect(result.current.data?.syncedAt).toBe('2026-10-01T10:05:00.000Z'));
    expect(requests[0]?.get('compact')).toBe('1');
    expect(requests[0]?.has('updatedSince')).toBe(false);

    await client.refetchQueries({ queryKey: queryKeys.sessions(FACTORY_ID) });

    expect(requests.map(params => params.get('updatedSince'))).toEqual([null, '2026-10-01T10:05:00.000Z']);
    await waitFor(() => expect(result.current.data?.syncedAt).toBe('2026-10-01T10:07:00.000Z'));
    expect(titles(result.current.data)).toEqual([
      ['session-1', null, 'Ada'],
      ['session-3', null, 'Ada'],
      ['session-2', 'Renamed', 'Ada'],
      ['session-4', null, 'Grace'],
    ]);
    expect(result.current.data?.userSessions.map(session => session.sessionId)).toEqual(['session-2', 'session-4']);
  });

  it('re-reads the full list when a session disappeared elsewhere', async () => {
    let full = [summary(1), summary(2), summary(3)];
    const requests = stubSessionsList({
      full: () => ({ sessions: full, owners, total: full.length, syncedAt: '2026-10-01T10:05:00.000Z' }),
      delta: () => ({ sessions: [], owners: {}, total: 2, syncedAt: '2026-10-01T10:07:00.000Z' }),
    });
    const client = createQueryClient();
    const { result } = renderHookWithProviders(() => useWorkspacesQuery(FACTORY_ID), { client });
    await waitFor(() => expect(allSessionRows(result.current.data)).toHaveLength(3));

    full = [summary(1), summary(3)];
    await client.refetchQueries({ queryKey: queryKeys.sessions(FACTORY_ID) });

    expect(requests.map(params => params.get('updatedSince'))).toEqual([null, '2026-10-01T10:05:00.000Z', null]);
    await waitFor(() =>
      expect(allSessionRows(result.current.data).map(session => session.sessionId)).toEqual(['session-1', 'session-3']),
    );
  });

  it('keeps full reads and inline owners against a server without the compact list', async () => {
    const requests = stubSessionsList({
      full: () => ({ sessions: [{ ...summary(1), owner: { id: 'user-1', name: 'Ada' } }] }),
      delta: () => ({ sessions: [] }),
    });
    const client = createQueryClient();
    const { result } = renderHookWithProviders(() => useWorkspacesQuery(FACTORY_ID), { client });
    await waitFor(() => expect(allSessionRows(result.current.data)).toHaveLength(1));

    await client.refetchQueries({ queryKey: queryKeys.sessions(FACTORY_ID) });

    expect(requests.map(params => params.get('updatedSince'))).toEqual([null, null]);
    expect(titles(result.current.data)).toEqual([['session-1', null, 'Ada']]);
  });
});
