/**
 * The board search used to filter only the candidates already loaded, so a
 * pull request pages deep in the feed never showed up. The query now goes to
 * the server, which answers with the matches on its first page.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

/** Stubs the review board's endpoints; the feed answers `q=21068` with the deep pull request and nothing else. */
function stubReviewBoard() {
  const requestedQueries: Array<string | null> = [];
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
      const query = new URL(request.url).searchParams.get('q');
      requestedQueries.push(query);
      return HttpResponse.json(
        query === '21068'
          ? { pullRequests: [pullRequest(21068, 'Retry failed uploads')], nextPage: null }
          : { pullRequests: [pullRequest(7, 'Fix login')], nextPage: 2 },
      );
    }),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
  );
  return requestedQueries;
}

describe('Board search reaches the server', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the feed for the query and shows a pull request that was never loaded', async () => {
    const requestedQueries = stubReviewBoard();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/review?q=21068`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    const intake = await screen.findByTestId('board-column-intake');
    await waitFor(() => expect(within(intake).getByText('Retry failed uploads')).toBeInTheDocument());
    expect(within(intake).queryByText('Fix login')).not.toBeInTheDocument();
    expect(requestedQueries).toEqual(['21068']);
  });
});
