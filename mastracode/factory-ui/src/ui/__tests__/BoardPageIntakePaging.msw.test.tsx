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

import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { IntakeCandidateListResponse } from '../../api/types';
import { createAppRoutes } from '../router';
import { githubIssueRecord, githubPullRequestRecord } from './fixtures/intakeCandidates';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

/** The server pages its list by cursor; these stand in for three and two pages of it. */
const pullRequestPages: Record<string, IntakeCandidateListResponse> = {
  '1': { candidates: [githubPullRequestRecord(7, { title: 'Fix login' })], nextCursor: '2', passes: [] },
  '2': { candidates: [githubPullRequestRecord(8, { title: 'Fix signup' })], nextCursor: '3', passes: [] },
  '3': { candidates: [githubPullRequestRecord(9, { title: 'Fix logout' })], passes: [] },
};

const triaged = { labels: ['status: auto-triaged'] };
const triageIssuePages: Record<string, IntakeCandidateListResponse> = {
  '1': { candidates: [githubIssueRecord(17, { title: 'Triage login', ...triaged })], nextCursor: '2', passes: [] },
  '2': { candidates: [githubIssueRecord(18, { title: 'Triage signup', ...triaged })], passes: [] },
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/intake/candidates`, ({ request }) => {
      const page = new URL(request.url).searchParams.get('cursor') ?? '1';
      requestedPages.push(page);
      return HttpResponse.json(pullRequestPages[page]);
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
  );
  return requestedPages;
}

/** Stubs Work, whose Triage and Intake columns page the one list between them. */
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
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/intake/candidates`, async ({ request }) => {
      const page = new URL(request.url).searchParams.get('cursor') ?? '1';
      requestedTriagePages.push(page);
      if (page === '2') await secondPageGate;
      return HttpResponse.json(triageIssuePages[page]);
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
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
    releaseSecondPage();

    await waitFor(() => expect(within(triage).getByText('Triage signup')).toBeInTheDocument());
    expect(within(triage).queryByRole('status', { name: 'Loading more candidates' })).not.toBeInTheDocument();
    expect(requestedTriagePages).toEqual(['1', '2']);
  });

  it('announces loading without showing a card skeleton while an empty visible column scroll-loads', async () => {
    const { scrollSentinel } = stubIntersectionObserver(false);
    const { requestedTriagePages, releaseSecondPage } = stubWorkBoard();
    const { client } = renderWorkBoard('?search=signup');

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
