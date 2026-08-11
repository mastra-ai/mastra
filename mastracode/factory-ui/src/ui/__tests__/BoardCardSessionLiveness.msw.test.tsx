/**
 * A board card's click outcome depends on whether its bound session still
 * exists. Deleting that session from the sidebar has to flip the card back to
 * "Start session" straight away — otherwise the card offers to open a thread
 * that was destroyed with its workspace.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createQueryClient } from '../../query-client';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const ITEM_ID = 'item-1';
const SESSION_ID = 'session-1';

const boundSession = {
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

const workItem = {
  id: ITEM_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: FACTORY_ID,
  source: 'github-issue',
  sourceKey: 'github-issue:1',
  parentWorkItemId: null,
  title: 'Fix login bug',
  url: null,
  stages: ['triage'],
  stageHistory: [],
  sessions: {
    chat: { sessionId: SESSION_ID, branch: 'factory/issue-1', threadId: SESSION_ID, startedBy: 'user-1' },
  },
  metadata: {},
  revision: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

/**
 * Board + sidebar wired to one work item bound to one live session. The session
 * list is served from mutable state so the DELETE genuinely removes it, the way
 * the server does.
 */
function stubFactoryWithBoundSession() {
  let sessions = [boundSession];
  const deleted: string[] = [];
  // Held open after the delete so the test proves the card stops advertising a
  // dead thread on its own, rather than riding on the reconciling refetch.
  const refetchGate = deferred();
  let sessionListRequests = 0;

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [workItem] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/decisions`, () =>
      HttpResponse.json({ decisions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, async () => {
      sessionListRequests += 1;
      if (sessionListRequests > 1) await refetchGate.promise;
      return HttpResponse.json({ sessions });
    }),
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/ensure`, () => HttpResponse.json({ ok: true })),
    http.delete(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
      deleted.push(String(params.sessionId));
      sessions = sessions.filter(session => session.sessionId !== params.sessionId);
      return HttpResponse.json({ removed: true });
    }),
  );

  return { deleted, refetchGate };
}

/**
 * Renders through the app's real query client. The default test client uses
 * `staleTime: 0`, which papers over cache-freshness bugs by refetching on
 * every mount; the shipped client caches for 30s.
 */
function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />, createQueryClient());
}

describe('Board card session liveness', () => {
  it('flips a card back to "Start session" when its session is deleted from the sidebar', async () => {
    const { deleted, refetchGate } = stubFactoryWithBoundSession();
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    await waitFor(() => expect(within(card).getByText('Open session')).toBeInTheDocument());

    await user.click(await screen.findByRole('button', { name: 'Session actions for factory/issue-1' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleted).toEqual([SESSION_ID]));

    // The reconciling refetch is still in flight. The card must already have
    // stopped advertising a thread it can no longer open.
    await waitFor(() =>
      expect(within(screen.getByTestId('work-item-card')).getByText('Start session')).toBeInTheDocument(),
    );
    expect(within(screen.getByTestId('work-item-card')).queryByText('Open session')).not.toBeInTheDocument();

    refetchGate.resolve();
    await waitFor(() =>
      expect(within(screen.getByTestId('work-item-card')).getByText('Start session')).toBeInTheDocument(),
    );
  });
});
