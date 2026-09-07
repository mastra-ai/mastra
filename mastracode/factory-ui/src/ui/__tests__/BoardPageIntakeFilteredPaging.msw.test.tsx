/**
 * Board filters run in the browser over the candidate pages already loaded.
 * The Intake sentinel auto-loads whenever it scrolls into view, so a filter
 * that hid every loaded candidate kept it in view and walked every open pull
 * request of the repository, one page after another. Under a filter, paging
 * is a click.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

function pullRequest(number: number, title: string) {
  return {
    number,
    title,
    url: `https://github.com/acme/app/pull/${number}`,
    author: 'alice',
    assignees: [],
    requestedReviewers: [],
    baseBranch: 'main',
    headBranch: `feat/${number}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

const pullRequestPages: Record<string, { pullRequests: ReturnType<typeof pullRequest>[]; nextPage: number | null }> = {
  '1': { pullRequests: [pullRequest(7, 'Fix login')], nextPage: 2 },
  '2': { pullRequests: [pullRequest(8, 'Fix signup')], nextPage: null },
};

/** The setup file's observer never intersects; this one reports every observed node as in view. */
class AlwaysInViewObserver {
  constructor(private readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void) {}
  observe() {
    this.callback([{ isIntersecting: true }]);
  }
  unobserve() {}
  disconnect() {}
}

/** Stubs the review board's endpoints and records which candidate pages were requested. */
function stubReviewBoard() {
  const requestedPages: string[] = [];
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
      HttpResponse.json({ workItems: [] }),
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
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, ({ request }) => {
      const page = new URL(request.url).searchParams.get('page') ?? '1';
      requestedPages.push(page);
      return HttpResponse.json(pullRequestPages[page]);
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
  );
  return requestedPages;
}

function renderReviewBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/review${search}`],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Intake paging under board filters', () => {
  beforeEach(() => vi.stubGlobal('IntersectionObserver', AlwaysInViewObserver));
  afterEach(() => vi.unstubAllGlobals());

  it('pages on click only while a filter hides the loaded candidates', async () => {
    const requestedPages = stubReviewBoard();
    const { client } = renderReviewBoard('?q=nothing-on-this-board');

    const intake = await screen.findByTestId('board-column-intake');
    await waitFor(() => expect(within(intake).getByText('No pull requests match filters')).toBeInTheDocument());
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(requestedPages).toEqual(['1']);

    await userEvent.click(within(intake).getByRole('button', { name: 'Load more candidates' }));
    await waitFor(() => expect(requestedPages).toEqual(['1', '2']));
  });

  it('keeps auto-loading the next page while nothing is filtered', async () => {
    const requestedPages = stubReviewBoard();
    renderReviewBoard();

    const intake = await screen.findByTestId('board-column-intake');
    await waitFor(() => expect(within(intake).getByText('Fix signup')).toBeInTheDocument());
    expect(requestedPages).toEqual(['1', '2']);
  });
});
