/**
 * A card advertises its bound session with a live indicator while that session
 * still exists. Deleting the session from the sidebar has to drop it straight
 * away — otherwise the details dialog offers a thread destroyed with its
 * workspace.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { createQueryClient } from '../../query-client';
import { AGENT_CONTROLLER_ID } from '../domains/chat/services/constants';
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

const workItemSessions: Record<string, { sessionId: string; branch: string; threadId: string; startedBy: string }> = {
  chat: { sessionId: SESSION_ID, branch: 'factory/issue-1', threadId: SESSION_ID, startedBy: 'user-1' },
};

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
  sessions: workItemSessions,
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
  let items = [{ ...workItem, sessions: { ...workItemSessions } }];
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
      HttpResponse.json({ workItems: items }),
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
    http.delete(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
      deleted.push(String(params.sessionId));
      sessions = sessions.filter(session => session.sessionId !== params.sessionId);
      // The server strips the deleted session's work-item refs with the row.
      items = items.map(item => ({
        ...item,
        sessions: Object.fromEntries(
          Object.entries(item.sessions).filter(([, ref]) => ref.sessionId !== params.sessionId),
        ),
      }));
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
  it('advertises a bound session the workspaces list does not know about', async () => {
    // Dispatcher-minted sessions appear on the work item before any sidebar
    // refetch sees them: the card must trust its own ref, not the intersection.
    stubFactoryWithBoundSession();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    );
    const user = userEvent.setup();
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    // Bound but idle: no marker runs — the Open session button on the card is
    // the advertisement, and only session-bound cards carry one.
    expect(await screen.findByRole('link', { name: 'Open session' })).toBeInTheDocument();
    expect(card.querySelector('[data-live-session-indicator]')).toBeNull();

    // The details panel keeps its own way in beside the card's.
    await user.click(screen.getByRole('button', { name: 'Details for Fix login bug' }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Open session' })).toHaveLength(2));
  });

  it('shows the initializing dot while a bound session is still materializing', async () => {
    stubFactoryWithBoundSession();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
        HttpResponse.json({ sessions: [{ ...boundSession, materializedAt: null }] }),
      ),
    );
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator="initializing"]')).not.toBeNull());
  });

  it('lights the working dot when any bound session runs, not just the newest ref', async () => {
    // Each role keeps its own session; a role re-run rewrites an existing key,
    // so the running session is not necessarily the last ref on the item.
    stubFactoryWithBoundSession();
    const reviewSession = {
      sessionId: 'session-2',
      branch: 'factory/issue-1',
      threadId: 'session-2',
      startedBy: 'user-1',
    };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [{ ...workItem, sessions: { ...workItemSessions, review: reviewSession } }],
        }),
      ),
      http.get('*/api/agent-controller/:controllerId/active-runs', () =>
        HttpResponse.json({ runs: [{ runId: 'run-1', resourceId: SESSION_ID, threadId: SESSION_ID }] }),
      ),
    );
    renderWorkBoard();

    const card = await screen.findByTestId('work-item-card');
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator="working"]')).not.toBeNull());
  });

  it('walks idle → working → idle as a run starts and finishes', async () => {
    const { refetchGate } = stubFactoryWithBoundSession();
    refetchGate.resolve();
    const active = new Set<string>();
    server.use(
      http.get('*/api/agent-controller/:controllerId/active-runs', () =>
        HttpResponse.json({
          runs: [...active].map(resourceId => ({ runId: `run-${resourceId}`, resourceId, threadId: resourceId })),
        }),
      ),
    );
    const { client } = renderWorkBoard();
    const activityKey = queryKeys.agentControllerActivity(AGENT_CONTROLLER_ID, TEST_BASE_URL);

    const card = await screen.findByTestId('work-item-card');
    expect(await screen.findByRole('link', { name: 'Open session' })).toBeInTheDocument();
    expect(card.querySelector('[data-live-session-indicator]')).toBeNull();

    active.add(SESSION_ID);
    await client.invalidateQueries({ queryKey: activityKey });
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator="working"]')).not.toBeNull());
    // A running card's one button is the way into its session; the wick is its marker, so the pill stays quiet.
    expect(screen.getByRole('link', { name: 'Open session' })).toHaveAttribute('data-variant', 'default');

    active.delete(SESSION_ID);
    await client.invalidateQueries({ queryKey: activityKey });
    // A finished run is an idle session: the wick goes dark and the button returns, unlit.
    await waitFor(() => expect(card.querySelector('[data-live-session-indicator]')).toBeNull());
    expect(await screen.findByRole('link', { name: 'Open session' })).toHaveAttribute('data-variant', 'default');
  });

  it('drops the session indicator as soon as its session is deleted from the sidebar', async () => {
    const { deleted, refetchGate } = stubFactoryWithBoundSession();
    const user = userEvent.setup();
    renderWorkBoard();

    await screen.findByTestId('work-item-card');
    expect(await screen.findByRole('link', { name: 'Open session' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Session actions for factory/issue-1' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleted).toEqual([SESSION_ID]));

    // The reconciling refetch is still in flight. The card must already have
    // stopped advertising a thread it can no longer open.
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Open session' })).toBeNull());

    refetchGate.resolve();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Open session' })).toBeNull());
  });
});
