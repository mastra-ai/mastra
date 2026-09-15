/**
 * Filters, cards already on the board, and drafts can leave a loaded page with
 * nothing visible, so the Intake sentinel stays in view. A sentinel that fetched
 * whenever it was in view chained through every open pull request; now coming
 * into view loads one page and the next waits for a scroll or a click.
 */
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
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
  '2': { pullRequests: [pullRequest(8, 'Fix signup')], nextPage: 3 },
  '3': { pullRequests: [pullRequest(9, 'Fix logout')], nextPage: null },
};

/**
 * The setup file's observer never notifies. This one reports where the sentinel
 * is as soon as it is observed, like a browser does, and lets the test scroll it.
 */
function stubIntersectionObserver(startsInView: boolean) {
  let inView = startsInView;
  let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof notify) {
        notify = callback;
      }
      observe() {
        notify([{ isIntersecting: inView }]);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  return {
    scrollSentinel(nowInView: boolean) {
      inView = nowInView;
      act(() => notify([{ isIntersecting: nowInView }]));
    },
  };
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

function renderReviewBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/review`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Intake candidate paging', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads one page on its own when the sentinel starts in view, then waits for a click', async () => {
    stubIntersectionObserver(true);
    const requestedPages = stubReviewBoard();
    const { client } = renderReviewBoard();

    const intake = await screen.findByTestId('board-column-intake');
    await waitFor(() => expect(within(intake).getByText('Fix signup')).toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(requestedPages).toEqual(['1', '2']);

    await userEvent.click(within(intake).getByRole('button', { name: 'Load more candidates' }));
    await waitFor(() => expect(within(intake).getByText('Fix logout')).toBeInTheDocument());
    expect(requestedPages).toEqual(['1', '2', '3']);
  });

  it('fetches one page per scroll into view, never chaining into the next', async () => {
    const { scrollSentinel } = stubIntersectionObserver(false);
    const requestedPages = stubReviewBoard();
    const { client } = renderReviewBoard();

    const intake = await screen.findByTestId('board-column-intake');
    await waitFor(() => expect(within(intake).getByText('Fix login')).toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(requestedPages).toEqual(['1']);

    scrollSentinel(true);
    await waitFor(() => expect(within(intake).getByText('Fix signup')).toBeInTheDocument());
    await waitForMutationsIdle(client);
    expect(requestedPages).toEqual(['1', '2']);

    scrollSentinel(false);
    scrollSentinel(true);
    await waitFor(() => expect(within(intake).getByText('Fix logout')).toBeInTheDocument());
    expect(requestedPages).toEqual(['1', '2', '3']);
  });
});
