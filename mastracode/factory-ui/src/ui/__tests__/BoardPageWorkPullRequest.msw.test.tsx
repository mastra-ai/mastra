/**
 * Pull requests are reviewed on the Work board: a pull request's card sits in
 * Work Intake and its Review action moves it into Work's Review lane, where the
 * lane's rule queues the reviewer. Cards filed on the Review board before this
 * stay there and keep their own board.
 */
import type { WorkItemRow } from '@mastra/factory/storage/domains/work-items/base';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { FactoryTransitionResult } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';
import { reviewCandidate, reviewItem } from './fixtures/reviewCard';

const FACTORY_ID = reviewItem.factoryProjectId;
const projectUrl = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`;
const workPullRequest: WorkItemRow = { ...reviewItem, id: 'work-pr', board: 'work' };

function stubBoards({ items = [] as WorkItemRow[], candidates = [] as (typeof reviewCandidate)[] } = {}) {
  const data = { items };
  const created: Array<Record<string, unknown>> = [];
  const transitions: Array<Record<string, unknown>> = [];

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${projectUrl}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: 'repo-1',
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/prs`, () =>
      HttpResponse.json({ pullRequests: candidates, nextPage: null }),
    ),
    http.get(`${projectUrl}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ permissions: [] }),
    ),
    http.get(`${projectUrl}/work-items`, () => HttpResponse.json({ workItems: data.items })),
    http.post(`${projectUrl}/work-items`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      created.push(body);
      const filed: WorkItemRow = { ...reviewItem, id: 'filed-pr', board: String(body.board) };
      data.items = [filed];
      return HttpResponse.json({ workItem: filed });
    }),
    http.post(`${projectUrl}/work-items/:itemId/transition`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      transitions.push(body);
      data.items = data.items.map(item =>
        item.id === params.itemId ? { ...item, stages: [String(body.stage)], revision: item.revision + 1 } : item,
      );
      const result: FactoryTransitionResult = {
        status: 'accepted',
        transitionId: 'transition-1',
        itemId: String(params.itemId),
        revision: 2,
        stage: String(body.stage),
        decisions: [],
      };
      return HttpResponse.json({ result });
    }),
  );
  return { created, transitions };
}

function renderBoard(board: 'work' | 'review') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/${board}`] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('Pull requests on the Work board', () => {
  it('shows a pull request card in Work Intake and reviews it in the Work board Review lane', async () => {
    const { transitions } = stubBoards({ items: [workPullRequest] });
    const user = userEvent.setup();
    const { router, client } = renderBoard('work');

    const intake = await screen.findByRole('region', { name: 'Intake' });
    expect(await within(intake).findByText(reviewItem.title)).toBeVisible();

    await user.click(screen.getByRole('button', { name: `Actions for ${reviewItem.title}` }));
    // A pull request is reviewed, never triaged, planned or built.
    expect(await screen.findByRole('menuitem', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Mark done' })).toBeInTheDocument();
    for (const lane of ['Triage', 'Planning', 'Building']) {
      expect(screen.queryByRole('menuitem', { name: `Move to ${lane}` })).toBeNull();
    }
    await user.keyboard('{Escape}');

    await user.click(within(intake).getByRole('button', { name: 'Review' }));
    await waitForMutationsIdle(client);

    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`);
    expect(transitions).toEqual([
      expect.objectContaining({ board: 'work', stage: 'pr-review', cause: 'card_action', expectedRevision: 1 }),
    ]);
  });

  it('files a pull request from the feed onto Work and starts its review there', async () => {
    const { created, transitions } = stubBoards({ candidates: [reviewCandidate] });
    const user = userEvent.setup();
    const { client } = renderBoard('work');

    const intake = await screen.findByRole('region', { name: 'Intake' });
    await within(intake).findByText(reviewCandidate.title);
    await user.click(within(intake).getByRole('button', { name: 'Review' }));
    await waitForMutationsIdle(client);

    expect(created).toEqual([expect.objectContaining({ board: 'work', title: reviewCandidate.title })]);
    expect(transitions).toEqual([expect.objectContaining({ board: 'work', stage: 'pr-review' })]);
  });

  it('keeps a card filed on the Review board there, off Work', async () => {
    stubBoards({ items: [reviewItem] });
    renderBoard('review');
    const reviewIntake = await screen.findByRole('region', { name: 'Intake' });
    expect(await within(reviewIntake).findByText(reviewItem.title)).toBeVisible();
  });

  it('does not show a Review board card on Work', async () => {
    stubBoards({ items: [reviewItem] });
    const { client } = renderBoard('work');
    await screen.findByRole('region', { name: 'Intake' });
    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.queryByText('Intake is clear')).toBeInTheDocument());
    expect(screen.queryByText(reviewItem.title)).toBeNull();
  });
});
