/**
 * A PR that reached Done but is still open on GitHub may have picked up new
 * commits after its review — nothing re-queues it automatically. The Done-lane
 * card offers a manual "Re-review" that moves the card back into PR review, where
 * the lane's rule queues a fresh review run. Merged PRs don't get the action:
 * there's nothing left to review.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { listedRepository } from '../../../e2e/ui/factory-projects';
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
  board: 'work',
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

/** Stubs the review board's data endpoints and captures what a Re-review writes. */
function stubReviewBoard({ workItems = [donePrWorkItem] as object[] } = {}) {
  const transitions: Array<Record<string, unknown>> = [];

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Acme Factory',
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
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
    // Work browses the repository's issues beside its pull requests.
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [reviewSession] }),
    ),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/:itemId/transition`,
      async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        transitions.push(body);
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-1',
            itemId: String(params.itemId),
            revision: 9,
            stage: body.stage,
            decisions: [],
          },
        });
      },
    ),
  );

  return { transitions };
}

function renderReviewBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('Re-review action for open PRs in Done', () => {
  it('moves a Done-lane open PR back into PR review on Work, where its rule queues the run', async () => {
    const { transitions } = stubReviewBoard();
    const user = userEvent.setup();
    const { router, client } = renderReviewBoard();

    await user.click(await screen.findByRole('button', { name: 'Actions for Add rate limiting' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Re-review' }));

    await waitForMutationsIdle(client);
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`);
    expect(transitions).toEqual([
      expect.objectContaining({ board: 'work', stage: 'pr-review', cause: 'card_action', expectedRevision: 1 }),
    ]);
  });

  it('offers a merged PR in Done no lane at all', async () => {
    stubReviewBoard({
      workItems: [{ ...donePrWorkItem, metadata: { number: 42, state: 'closed', merged: true } }],
    });
    const user = userEvent.setup();
    renderReviewBoard();

    await user.click(await screen.findByRole('button', { name: 'Actions for Add rate limiting' }));
    await screen.findByRole('menuitem', { name: 'Remove' });
    expect(screen.queryByRole('menuitem', { name: /^(Re-)?review$/ })).not.toBeInTheDocument();
  });
});
