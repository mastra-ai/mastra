/**
 * Opening Factory should not wait on one request after another. The route
 * loaders start the page's queries when the app starts, so the only wait left
 * is the slowest request. These tests drive the real route table, query client
 * and loaders, with MSW answering at the network boundary.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createApiConfig } from '../../api/config';
import { createQueryClient } from '../../query-client';
import { factory, signedIn, signedOut } from '../domains/auth/components/__tests__/fixtures/auth';
import { createAppRoutes } from '../router';

const AUTH_ME_URL = `${TEST_BASE_URL}/auth/me`;
const PROJECTS_URL = `${TEST_BASE_URL}/web/factory/projects`;
const projects = () => HttpResponse.json({ projects: [{ ...factory, repositories: [] }] });

// Requests no loader can start, so they go out once the page renders.
const STARTED_BY_THE_PAGE = [
  // The feed: a long-lived event stream the layout opens, not a query.
  /\/feed-events$/,
  // The composer's model list: keyed by the Factory's model scope, read from the project first.
  /^GET \/web\/config\/models\b/,
];
// Settings sections load their own data once they render; only their code is started early.
const SETTINGS_SECTION_DATA = [/^GET \/api\/agent-controller\/code\/sessions\/factory-1$/];

function renderApp(path: string) {
  // The sidebar's session list, the chat's permissions and the composer's model
  // defaults have no ambient handler.
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId`, () => HttpResponse.json({ project: factory })),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/permissions`, () => HttpResponse.json({})),
  );
  const client = createQueryClient();
  const routes = createAppRoutes({ queryClient: client, api: createApiConfig({ baseUrl: TEST_BASE_URL }) });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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

function returnToTab() {
  fireEvent(document, new Event('visibilitychange', { bubbles: true }));
}

afterEach(() => vi.useRealTimers());

describe('Opening Factory', () => {
  it.each([
    '/factories/factory-1/work',
    '/factories/factory-1/review',
    '/factories/factory-1/rules?group=failed',
    '/factories/factory-1/new',
    '/factories/factory-1/settings/preferences',
  ])('loads everything %s needs during the sign-in check, once each', async path => {
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
      http.get(PROJECTS_URL, projects),
    );
    const { client } = renderApp(path);

    // Everything the loaders started has answered; only the sign-in check is left.
    await waitFor(() => expect(client.isFetching()).toBe(1));
    const prefetched = client.getQueryCache().getAll();
    finishSignInCheck();
    await screen.findByRole('navigation', { name: path.includes('/settings/') ? 'Settings sections' : 'Main' });
    await waitFor(() => expect(screen.queryByLabelText('Loading page')).not.toBeInTheDocument());
    await waitForMutationsIdle(client);

    const startup = requests.filter(({ afterSignIn }) => !afterSignIn).map(({ url }) => url);
    const late = requests
      .filter(({ afterSignIn, url }) => afterSignIn && !startup.includes(url))
      .map(({ url }) => url)
      .filter(url => !STARTED_BY_THE_PAGE.some(pattern => pattern.test(url)))
      .filter(url => !(path.includes('/settings/') && SETTINGS_SECTION_DATA.some(pattern => pattern.test(url))));
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

  it('loads the factories once a visitor who opened the app signed out signs in from another tab', async () => {
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedOut)));
    let signedInElsewhere = false;
    const listRequested = vi.fn(() => (signedInElsewhere ? projects() : new HttpResponse(undefined, { status: 401 })));
    server.use(http.get(PROJECTS_URL, listRequested));
    const { router } = renderApp('/factories/factory-1/work');

    await screen.findByRole('button', { name: 'Continue with GitHub' });
    // The list went out with the sign-in check and was refused.
    expect(listRequested).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();

    signedInElsewhere = true;
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedIn)));
    returnToTab();

    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/factories/factory-1/work');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
