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

function issue(number: number, title: string) {
  return {
    number,
    title,
    url: `https://github.com/acme/app/issues/${number}`,
    author: 'alice',
    assignee: null,
    labels: ['status: auto-triaged'],
    comments: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

const pullRequestPages: Record<string, { pullRequests: ReturnType<typeof pullRequest>[]; nextPage: number | null }> = {
  '1': { pullRequests: [pullRequest(7, 'Fix login')], nextPage: 2 },
  '2': { pullRequests: [pullRequest(8, 'Fix signup')], nextPage: 3 },
  '3': { pullRequests: [pullRequest(9, 'Fix logout')], nextPage: null },
};

const triageIssuePages: Record<string, { issues: ReturnType<typeof issue>[]; nextPage: number | null }> = {
  '1': { issues: [issue(17, 'Triage login')], nextPage: 2 },
  '2': { issues: [issue(18, 'Triage signup')], nextPage: null },
};

/**
 * The setup file's observer never notifies. This one reports where the sentinel
 * is as soon as it is observed, like a browser does, and lets the test scroll it.
 */
function stubIntersectionObserver(startsInView: boolean) {
  let inView = startsInView;
  type Notify = (entries: Array<{ isIntersecting: boolean }>) => void;
  const observed = new Map<Element, Notify>();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly notify: Notify;

      constructor(callback: Notify) {
        this.notify = callback;
      }
      observe(element: Element) {
        observed.set(element, this.notify);
        this.notify([{ isIntersecting: inView }]);
      }
      unobserve(element: Element) {
        observed.delete(element);
      }
      disconnect() {
        for (const [element, notify] of observed) {
          if (notify === this.notify) observed.delete(element);
        }
      }
    },
  );
  return {
    scrollSentinel(nowInView: boolean) {
      inView = nowInView;
      act(() => {
        for (const notify of new Set(observed.values())) notify([{ isIntersecting: nowInView }]);
      });
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
    http.get(`${TEST_BASE_URL}/web/source-control/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
  );
  return requestedPages;
}

/** Stubs Work's independent Intake and Triage candidate feeds. */
function stubWorkBoard() {
  const requestedTriagePages: string[] = [];
  let releaseSecondPage = () => {};
  const secondPageGate = new Promise<void>(resolve => {
    releaseSecondPage = resolve;
  });
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
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/intake/label-routes`, () => HttpResponse.json({ routes: [] })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, async ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (!params.has('label')) return HttpResponse.json({ issues: [], nextPage: null });
      const page = params.get('page') ?? '1';
      requestedTriagePages.push(page);
      if (page === '2') await secondPageGate;
      return HttpResponse.json(triageIssuePages[page]);
    }),
    http.get(`${TEST_BASE_URL}/web/source-control/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
  );
  return { requestedTriagePages, releaseSecondPage };
}

function renderReviewBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/review`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

function renderWorkBoard(query = '') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work${query}`] });
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

  it('shows one shimmering card skeleton while a populated column scroll-loads', async () => {
    const { scrollSentinel } = stubIntersectionObserver(false);
    const { requestedTriagePages, releaseSecondPage } = stubWorkBoard();
    const { client } = renderWorkBoard();

    const triage = await screen.findByTestId('board-column-triage');
    expect(await within(triage).findByText('Triage login')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(requestedTriagePages).toEqual(['1']);

    scrollSentinel(true);
    const skeleton = await within(triage).findByRole('status', { name: 'Loading more candidates' });
    expect(skeleton.children).toHaveLength(1);
    expect(skeleton.firstElementChild).toHaveClass('before:animate-[shimmer_2s_infinite]', 'before:bg-linear-to-r');
    releaseSecondPage();

    await waitFor(() => expect(within(triage).getByText('Triage signup')).toBeInTheDocument());
    expect(requestedTriagePages).toEqual(['1', '2']);
  });

  it('announces loading without showing a card skeleton while an empty visible column scroll-loads', async () => {
    const { scrollSentinel } = stubIntersectionObserver(false);
    const { requestedTriagePages, releaseSecondPage } = stubWorkBoard();
    const { client } = renderWorkBoard('?q=signup');

    const triage = await screen.findByTestId('board-column-triage');
    expect(await within(triage).findByRole('button', { name: 'Load more candidates' })).toBeInTheDocument();
    expect(within(triage).queryByText('Triage login')).not.toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(requestedTriagePages).toEqual(['1']);

    scrollSentinel(true);
    await waitFor(() => expect(requestedTriagePages).toEqual(['1', '2']));
    const loadingStatus = within(triage).getByRole('status');
    expect(loadingStatus).toHaveTextContent('Loading more candidates');
    expect(loadingStatus.children).toHaveLength(0);
    releaseSecondPage();

    await waitFor(() => expect(within(triage).getByText('Triage signup')).toBeInTheDocument());
    expect(requestedTriagePages).toEqual(['1', '2']);
  });
});
