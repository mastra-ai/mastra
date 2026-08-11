/**
 * Deleting a session has to survive a list read that was already in flight.
 * Such a read left the server before the delete committed, so it still carries
 * the deleted session — letting it settle would write the session straight back
 * over the removal and leave the board offering a dead thread again.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { createQueryClient } from '../../query-client';
import { removeCachedSession, useWorkspacesQuery } from '../useWorkspaces';

const REPO_ID = 'repo-1';
const SESSION_ID = 'session-1';

const session = {
  id: 'session-row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/issue-1',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: '/repo',
  materializedAt: '2026-07-18T00:00:00.000Z',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('removeCachedSession', () => {
  it('is not undone by a list fetch that was already in flight', async () => {
    const gate = deferred();
    let requests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, async () => {
        requests += 1;
        // The second read is the one racing the delete: it resolves after the
        // removal and still reports the session as present.
        if (requests > 1) await gate.promise;
        return HttpResponse.json({ sessions: [session] });
      }),
    );

    const client = createQueryClient();
    const { result } = renderHookWithProviders(() => useWorkspacesQuery(REPO_ID), { client });

    await waitFor(() => expect(result.current.data?.workspaces).toHaveLength(1));

    // Put a read in flight, then delete while it is still outstanding.
    void client.refetchQueries({ queryKey: queryKeys.sessions(REPO_ID) });
    await waitFor(() => expect(requests).toBe(2));
    removeCachedSession(client, REPO_ID, SESSION_ID);
    await waitFor(() => expect(result.current.data?.workspaces).toHaveLength(0));

    gate.resolve();
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.current.data?.workspaces).toHaveLength(0);
  });
});
