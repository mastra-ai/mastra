import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import { createAppRoutes } from '../../../router';
import { CARD_MIME } from '../boardDrag';
import type { GithubPullRequest } from '../services/factory';
import type { WorkItem } from '../services/workItems';
import { pullRequest, reviewWorkItem, wireWorkItem } from './__tests__/fixtures';

function stubReviewBoard(
  workItems: WorkItem[],
  pullRequests: GithubPullRequest[] = [],
  nextPage: number | null = null,
) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/fp-1/permissions`, () =>
      HttpResponse.json({ permissions: {} }),
    ),
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () =>
      HttpResponse.json({ workItems: workItems.map(wireWorkItem) }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/prs`, () => HttpResponse.json({ pullRequests, nextPage })),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/sessions`, () => HttpResponse.json({ sessions: [] })),
  );
}

function renderReviewBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/fp-1/review${search}`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

function columnCardTitles(column: HTMLElement) {
  return within(column)
    .queryAllByTestId(/^(work-item|candidate)-card$/)
    .map(card => within(card).getByText(/^Pull request \d+$/).textContent);
}

describe('Review stack columns', () => {
  it('groups saved and candidate cards together, sharing root headers across stages', async () => {
    stubReviewBoard(
      [reviewWorkItem(pullRequest(2, 'feature-1'), ['intake']), reviewWorkItem(pullRequest(3, 'feature-2'))],
      [pullRequest(9), pullRequest(1)],
    );
    renderReviewBoard();
    await screen.findByText('Pull request 1');
    const intake = screen.getByTestId('board-column-intake');
    const reviewing = screen.getByTestId('board-column-review');
    expect(columnCardTitles(intake)).toEqual(['Pull request 1', 'Pull request 2', 'Pull request 9']);
    expect(within(intake).getByRole('heading', { name: 'Stack #1 · Pull request 1' })).toBeInTheDocument();
    expect(within(reviewing).getByRole('heading', { name: 'Stack #1 · Pull request 1' })).toBeInTheDocument();
    expect(columnCardTitles(reviewing)).toEqual(['Pull request 3']);
  });

  it('retains the root and dependency order when filters hide a middle PR', async () => {
    const items = [1, 2, 3].map(number =>
      reviewWorkItem(pullRequest(number, number === 1 ? 'main' : `feature-${number - 1}`)),
    );
    items[0].metadata.labels = ['keep'];
    items[2].metadata.labels = ['keep'];
    stubReviewBoard(items);
    renderReviewBoard('?label=keep');
    await screen.findByRole('heading', { name: 'Stack #1 · Pull request 1' });
    const reviewing = screen.getByTestId('board-column-review');
    expect(columnCardTitles(reviewing)).toEqual(['Pull request 1', 'Pull request 3']);
    await userEvent
      .setup()
      .type(
        within(screen.getByLabelText('Board filters')).getByRole('textbox', { name: 'Search cards' }),
        'Pull request 3',
      );
    await waitFor(() => expect(columnCardTitles(reviewing)).toEqual(['Pull request 3']));
    expect(within(reviewing).getByRole('heading', { name: 'Stack #1 · Pull request 1' })).toBeInTheDocument();
  });

  it('preserves the card budget and reveals a deep-linked dependent beyond it', async () => {
    const items = Array.from({ length: 45 }, (_, index) =>
      reviewWorkItem(pullRequest(index + 1, index === 0 ? 'main' : `feature-${index}`)),
    );
    stubReviewBoard(items);
    const firstRender = renderReviewBoard();
    await screen.findByRole('heading', { name: 'Stack #1 · Pull request 1' });
    expect(screen.getAllByTestId('work-item-card')).toHaveLength(30);
    expect(screen.queryByLabelText('Pull request 45')).not.toBeInTheDocument();
    firstRender.unmount();
    renderReviewBoard('?item=pr-45');
    expect(await screen.findByRole('button', { name: 'Details for Pull request 45' })).toHaveFocus();
    expect(screen.getAllByTestId('work-item-card')).toHaveLength(45);
  });

  it('discovers stacks when another candidate page loads without fetching it eagerly', async () => {
    stubReviewBoard([], [pullRequest(2, 'feature-1')], 2);
    const requestedPages: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/prs`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        requestedPages.push(page);
        return HttpResponse.json({
          pullRequests: [pullRequest(page === '1' ? 2 : 1, page === '1' ? 'feature-1' : 'main')],
          nextPage: page === '1' ? 2 : null,
        });
      }),
    );
    renderReviewBoard();
    await screen.findByText('Pull request 2');
    expect(requestedPages).toEqual(['1']);
    expect(screen.queryByRole('heading', { name: /Stack/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load more candidates' }));
    await screen.findByRole('heading', { name: 'Stack #1 · Pull request 1' });
    expect(columnCardTitles(screen.getByTestId('board-column-intake'))).toEqual(['Pull request 1', 'Pull request 2']);
    expect(requestedPages).toEqual(['1', '2']);
  });

  it('moves only the dragged card to the target stage', async () => {
    stubReviewBoard([reviewWorkItem(pullRequest(2, 'feature-1'), ['intake'])], [pullRequest(1)]);
    const requests: unknown[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items/pr-2/transition`, async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({ result: { status: 'rejected', reason: 'Review is paused' } });
      }),
    );
    renderReviewBoard();
    await screen.findByRole('heading', { name: 'Stack #1 · Pull request 1' });
    const dataTransfer = {
      types: [CARD_MIME],
      getData: () => JSON.stringify({ kind: 'work-item', id: 'pr-2', fromStage: 'intake' }),
    };
    const reviewing = screen.getByTestId('board-column-review');
    fireEvent.dragOver(reviewing, { dataTransfer });
    fireEvent.drop(reviewing, { dataTransfer });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ board: 'review', stage: 'review', cause: 'board_drag' });
    expect(await screen.findByText('Review is paused')).toBeInTheDocument();
  });
});
