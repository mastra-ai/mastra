/**
 * Opening Factory should not wait on one request after another. The route
 * loaders start the page's code and queries when the app starts, so the page
 * waits only for its slowest request. These tests drive the real route table,
 * query client and loaders, with MSW answering at the network boundary.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { builtinBoardCatalog, releaseBoard } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_API, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createQueryClient } from '../../query-client';
import { factory, signedIn, signedOut } from '../domains/auth/components/__tests__/fixtures/auth';
import { createAppRoutes } from '../router';

const AUTH_ME_URL = `${TEST_BASE_URL}/auth/me`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/factory/projects`;
const linkedFactory = { ...factory, repositories: [listedRepository('project-repo-1', 'octo/app')] };
const emptyFactory = { ...factory, repositories: [] };

// Requests keyed by another response or by state a component resolves, so
// they go out once the page that reads them renders.
const STARTED_BY_THE_PAGE = [
  // The feed: a long-lived event stream the layout opens, not a query.
  /\/feed-events$/,
  // The chat's permissions: addressed by the session the chat provider resolves.
  /^GET \/api\/agent-controller\/code\/sessions\/[^/]+\/permissions$/,
  // The composer's model list: keyed by the Factory's model scope, read from the project.
  /^GET \/web\/config\/models\b/,
  // The board's issue and pull request lists: keyed by its repositories and intake settings.
  /^GET \/web\/github\/projects\/[^/]+\/(issues|prs)\b/,
  // GitHub label routes: read for GitHub repositories outside Review.
  /^GET \/web\/intake\/label-routes\b/,
  // The board's recent activity: keyed by the people on its cards.
  /^GET \/web\/factory\/projects\/[^/]+\/audit\b/,
];
// Settings sections load their own data once they render; only their code starts early.
const SETTINGS_SECTION_DATA = [/^GET \/api\/agent-controller\/code\/sessions\/factory-1$/];

function renderApp(
  path: string,
  {
    listed = linkedFactory,
    projects = () => HttpResponse.json({ projects: [listed] }),
  }: { listed?: typeof linkedFactory; projects?: Parameters<typeof http.get>[1] } = {},
) {
  server.use(
    http.get(PROJECTS_URL, projects),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/boards`, () =>
      HttpResponse.json({ boards: [...builtinBoardCatalog.boards, releaseBoard] }),
    ),
    // No ambient handler: the sidebar's sessions, the chat's permissions, the
    // composer's model defaults and the board's intake.
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/permissions`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId`, () => HttpResponse.json({ project: listed })),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ github: { enabled: true, sourceIds: null }, linear: { enabled: false, sourceIds: [] } }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/github/projects/:repositoryId/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
  );
  const client = createQueryClient();
  const router = createMemoryRouter(createAppRoutes({ queryClient: client, api: TEST_API }), {
    initialEntries: [path],
  });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

/** Every request the app sends, tagged with whether `/auth/me` had answered yet. */
function recordRequests() {
  const requests: { url: string; afterSignIn: boolean }[] = [];
  let signInAnswered = false;
  const listener = ({ request }: { request: Request }) => {
    const { pathname, search } = new URL(request.url);
    requests.push({ url: `${request.method} ${pathname}${search}`, afterSignIn: signInAnswered });
  };
  server.events.on('request:start', listener);
  onTestFinished(() => server.events.removeListener('request:start', listener));
  return { requests, markSignInAnswered: () => (signInAnswered = true) };
}

/** Whether `text` was ever added to the page, however briefly it stayed. */
function watchForText(text: string) {
  let seen = false;
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) if (node.textContent?.includes(text)) seen = true;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  onTestFinished(() => observer.disconnect());
  return () => seen;
}

function returnToTab() {
  fireEvent(document, new Event('visibilitychange', { bubbles: true }));
}

describe('Opening Factory', () => {
  it.each([
    { page: 'Work', path: '/factories/factory-1/work' },
    // The retired Review board's links open Work, so they load what Work needs.
    { page: 'Work from a Review board link', path: '/factories/factory-1/review' },
    { page: 'a custom board', path: '/factories/factory-1/boards/release' },
    { page: 'Rules', path: '/factories/factory-1/rules?group=failed' },
    { page: 'a new session', path: '/factories/factory-1/new' },
    { page: 'a draft session', path: '/factories/factory-1/user/new/draft-1' },
    { page: 'Settings', path: '/factories/factory-1/settings/preferences' },
    { page: 'Work before a repository is linked', path: '/factories/factory-1/work', listed: emptyFactory },
  ])('loads everything $page needs during the sign-in check, once each', async ({ path, listed }) => {
    const { requests, markSignInAnswered } = recordRequests();
    let finishSignInCheck = () => {};
    const signInCheck = new Promise<void>(resolve => {
      finishSignInCheck = resolve;
    });
    onTestFinished(finishSignInCheck);
    server.use(
      http.get(AUTH_ME_URL, async () => {
        await signInCheck;
        markSignInAnswered();
        return HttpResponse.json(signedIn);
      }),
    );
    const { client } = renderApp(path, { listed });

    // Everything the loaders started has answered; only the sign-in check is left.
    await waitFor(() => expect(client.isFetching()).toBe(1));
    const prefetched = client.getQueryCache().getAll();
    finishSignInCheck();
    const settings = path.includes('/settings/');
    await screen.findByRole('navigation', { name: settings ? 'Settings sections' : 'Main' });
    await waitFor(() => expect(screen.queryByLabelText('Loading page')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);

    const startedEarly = new Set(requests.filter(({ afterSignIn }) => !afterSignIn).map(({ url }) => url));
    const late = requests
      .filter(({ afterSignIn, url }) => afterSignIn && !startedEarly.has(url))
      .map(({ url }) => url)
      .filter(url => !STARTED_BY_THE_PAGE.some(pattern => pattern.test(url)))
      .filter(url => !(settings && SETTINGS_SECTION_DATA.some(pattern => pattern.test(url))));
    expect(late, 'requests that waited for the sign-in check').toEqual([]);
    // The page settles well before the first poll (2 s), so any repeat is a second fetch.
    const sent = requests.map(({ url }) => url);
    expect(
      sent.filter((url, index) => sent.indexOf(url) !== index),
      'requests sent twice',
    ).toEqual([]);
    const unread = prefetched.filter(query => query.getObserversCount() === 0).map(query => query.queryHash);
    expect(unread, 'queries started for the page but never read by it').toEqual([]);
  });

  it('loads the Factory list during the sign-in check from a link without a Factory', async () => {
    const { requests, markSignInAnswered } = recordRequests();
    server.use(
      http.get(AUTH_ME_URL, async () => {
        // Answer only once the list has left, so a list waiting for the check fails here.
        await waitFor(() => expect(requests.map(({ url }) => url)).toContain('GET /web/factory/projects'));
        markSignInAnswered();
        return HttpResponse.json(signedIn);
      }),
    );
    const { router } = renderApp('/');

    await waitFor(() => expect(router.state.location.pathname).toBe('/factories/factory-1/work'));
    expect(requests).toContainEqual({ url: 'GET /web/factory/projects', afterSignIn: false });
  });

  it('keeps a Factory id from a crafted link inside the requests it starts', async () => {
    const { requests } = recordRequests();
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedIn)));
    const { router } = renderApp('/factories/..%2F..%2F..%2Fauth%2Flogout/work');

    await waitFor(() => expect(router.state.location.pathname).toBe('/factories/factory-1/work'));
    expect(requests.map(({ url }) => url).filter(url => url.includes('/auth/logout'))).toEqual([]);
  });

  it('loads the factories once a visitor who opened the app signed out signs in from another tab', async () => {
    const listFailureShown = watchForText('Unable to load your factories');
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedOut)));
    let signedInElsewhere = false;
    const listRequested = vi.fn(() =>
      signedInElsewhere
        ? HttpResponse.json({ projects: [linkedFactory] })
        : new HttpResponse(undefined, { status: 401 }),
    );
    const { router } = renderApp('/factories/factory-1/work', { projects: listRequested });

    await screen.findByRole('button', { name: 'Continue with GitHub' });
    // The list went out with the sign-in check and was refused.
    expect(listRequested).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();

    signedInElsewhere = true;
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedIn)));
    returnToTab();

    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factories/factory-1/work');
    expect(listFailureShown()).toBe(false);
  });
});
