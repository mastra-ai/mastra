/**
 * A PR that reached Done but is still open on GitHub may have picked up new
 * commits after its review — nothing re-queues it automatically. The Done-lane
 * card offers a manual "Re-review" action that starts a fresh review run even
 * though the review session slot is already used, instead of just reopening
 * the old thread. Merged PRs don't get the action: there's nothing left to
 * review.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const SESSION_ID = 'session-review-42';

// The review session still exists, so the card's review slot reads as live —
// exactly the case the plain Review action refuses to re-offer.
const reviewSession = {
  id: 'session-row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/pr-42',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: '/repo',
  materializedAt: '2026-07-18T00:00:00.000Z',
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

// Wire shape as served by /web/factory/*/work-items: the client derives
// `source`/`url` from `externalSource` (see fromWireWorkItem).
const donePrWorkItem = {
  id: 'item-pr-42',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: FACTORY_ID,
  externalSource: {
    integrationId: 'github',
    type: 'pull-request',
    externalId: 'github-pr:42',
    url: 'https://github.com/acme/app/pull/42',
  },
  parentWorkItemId: null,
  title: 'Add rate limiting',
  stages: ['done'],
  stageHistory: [],
  sessions: {
    review: { sessionId: SESSION_ID, branch: 'factory/pr-42', threadId: 'thread-42', startedBy: 'user-1' },
  },
  metadata: { number: 42, state: 'open' },
  revision: 1,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const NEW_THREAD_ID = 'thread-rereview-1';

/** Stubs the review board's data endpoints and captures run-start requests. */
function stubReviewBoard({ workItems = [donePrWorkItem] as object[] } = {}) {
  const startRequests: Array<Record<string, unknown>> = [];

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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [reviewSession] }),
    ),
    // Re-review mints a fresh workspace session before kicking off the run.
    http.post(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, async ({ request }) => {
      const body = (await request.json()) as { branch?: string };
      return HttpResponse.json({ session: { ...reviewSession, branch: body.branch ?? reviewSession.branch } });
    }),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/permissions`, () =>
      HttpResponse.json({ permissions: [] }),
    ),
    // The thread page the successful kickoff navigates to.
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () => HttpResponse.json({ session: reviewSession })),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId`, () =>
      HttpResponse.json({ id: SESSION_ID, resourceId: SESSION_ID, state: {} }),
    ),
    http.put(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/state`, () =>
      HttpResponse.json({ ok: true }),
    ),
    http.get(
      `${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions`, () =>
      HttpResponse.json({ id: SESSION_ID, resourceId: SESSION_ID }),
    ),
    http.post(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/thread`, () =>
      HttpResponse.json({ ok: true }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/threads`, () =>
      HttpResponse.json({ threads: [{ id: NEW_THREAD_ID, resourceId: SESSION_ID, title: 'Re-review PR #42' }] }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/threads/:threadId/messages`, () =>
      HttpResponse.json({ messages: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/runs/start`, async ({ request }) => {
      startRequests.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        prepared: { workItemId: 'item-pr-42', threadId: NEW_THREAD_ID, sessionId: SESSION_ID, kickoffStatus: 'sent' },
      });
    }),
  );

  return { startRequests };
}

function renderReviewBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/review`] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('Re-review action for open PRs in Done', () => {
  it('starts a fresh review run for a Done-lane open PR whose review slot is already used', async () => {
    const { startRequests } = stubReviewBoard();
    const user = userEvent.setup();
    const { router, client } = renderReviewBoard();

    await user.click(await screen.findByRole('button', { name: 'Actions for Add rate limiting' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Re-review' }));

    await waitForMutationsIdle(client);
    expect(startRequests).toHaveLength(1);
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/review`);
    expect(startRequests[0]).toMatchObject({
      sessionId: SESSION_ID,
      destinationStage: 'review',
      invocation: { type: 'skill', skillName: 'factory-review' },
      workItem: { id: 'item-pr-42', role: 'review' },
    });
  });

  it('starts the re-review hands-off, asking the server to preapprove its plans', async () => {
    const { startRequests } = stubReviewBoard();
    const user = userEvent.setup();
    const { client } = renderReviewBoard();

    await user.click(await screen.findByRole('button', { name: 'Actions for Add rate limiting' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Re-review hands-off' }));

    await waitForMutationsIdle(client);
    expect(startRequests).toHaveLength(1);
    expect(startRequests[0]).toMatchObject({
      preapprovePlans: true,
      workItem: { id: 'item-pr-42', role: 'review' },
    });
  });

  it('does not offer Re-review for a merged PR in Done', async () => {
    stubReviewBoard({
      workItems: [{ ...donePrWorkItem, metadata: { number: 42, state: 'closed', merged: true } }],
    });
    const user = userEvent.setup();
    renderReviewBoard();

    await user.click(await screen.findByRole('button', { name: 'Actions for Add rate limiting' }));
    await screen.findByRole('menuitem', { name: 'Remove' });
    expect(screen.queryByRole('menuitem', { name: 'Re-review' })).not.toBeInTheDocument();
  });
});
