import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { createQueryClient } from '../../../../../query-client';
import { SignInPage } from '../../../../pages/SignInPage';
import { RootGuards } from '../RootGuards';
import { factory, signedIn, signedOut } from './fixtures/auth';

const AUTH_ME_URL = `${TEST_BASE_URL}/auth/me`;
const CURRENT_PATH = '/factories/factory-1/work?view=mine#item-1';

function renderApp() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [factory] })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
  );
  const router = createMemoryRouter(
    [
      {
        element: <RootGuards />,
        children: [{ path: '/factories/:factoryId/work', element: <textarea aria-label="Draft" /> }],
      },
      { path: '/signin', element: <SignInPage /> },
    ],
    { initialEntries: [CURRENT_PATH] },
  );
  const rendered = renderWithProviders(<RouterProvider router={router} />, createQueryClient());
  return { router, ...rendered };
}

function returnToTab() {
  fireEvent(document, new Event('visibilitychange', { bubbles: true }));
}

afterEach(() => vi.useRealTimers());

describe('Factory session expiry', () => {
  it.each([
    { provider: 'workos', signInAction: 'Continue with GitHub' },
    { provider: 'better-auth', signInAction: 'Sign in' },
  ])(
    'keeps the draft and return URL when $provider expires while away from the tab',
    async ({ provider, signInAction }) => {
      server.use(http.get(AUTH_ME_URL, () => HttpResponse.json({ ...signedIn, provider })));
      const { router, client } = renderApp();
      const draft = await screen.findByRole('textbox', { name: 'Draft' });
      await userEvent.type(draft, 'Unsent work');
      await waitForMutationsIdle(client);

      server.use(http.get(AUTH_ME_URL, () => new HttpResponse(undefined, { status: 401 })));
      returnToTab();

      const dialog = await screen.findByRole('alertdialog', { name: 'Session expired' });
      expect(dialog).toHaveTextContent('Factory has stopped receiving updates');
      expect(router.state.location.pathname).toBe('/factories/factory-1/work');
      expect(draft).toHaveValue('Unsent work');
      await userEvent.keyboard('{Escape}');
      expect(dialog).toBeInTheDocument();

      // A 401 carries no provider metadata; the sign-in page must check it afresh.
      server.use(http.get(AUTH_ME_URL, () => HttpResponse.json({ ...signedOut, provider })));
      await userEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
      await screen.findByRole('button', { name: signInAction });
      expect(router.state.location.pathname).toBe('/signin');
      expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(CURRENT_PATH);
    },
  );

  it('detects expiry in a tab that stays open without any navigation or focus event', async () => {
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedIn)));
    const { client } = renderApp();
    await screen.findByRole('textbox', { name: 'Draft' });
    await waitForMutationsIdle(client);

    // Install fake timers before the next successful check schedules its heartbeat.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    returnToTab();
    await act(async () => {
      await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    });
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedOut)));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));

    await act(async () => {
      await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    });
    expect(await screen.findByRole('alertdialog', { name: 'Session expired' })).toBeInTheDocument();
  });

  it('keeps the app mounted during a server outage and detects expiry on recovery', async () => {
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedIn)));
    const { client } = renderApp();
    const draft = await screen.findByRole('textbox', { name: 'Draft' });
    await userEvent.type(draft, 'Keep this draft');
    await waitForMutationsIdle(client);

    const outage = vi.fn(() => new HttpResponse(undefined, { status: 503 }));
    server.use(http.get(AUTH_ME_URL, outage));
    returnToTab();
    await waitFor(() => expect(outage).toHaveBeenCalled());
    await waitForMutationsIdle(client);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(draft);
    expect(draft).toHaveValue('Keep this draft');

    server.use(http.get(AUTH_ME_URL, () => new HttpResponse(undefined, { status: 401 })));
    returnToTab();
    expect(await screen.findByRole('alertdialog', { name: 'Session expired' })).toBeInTheDocument();
  });

  it('sends an initially signed-out visitor to sign-in without an expiry dialog', async () => {
    server.use(http.get(AUTH_ME_URL, () => HttpResponse.json(signedOut)));
    const { router } = renderApp();

    await screen.findByRole('button', { name: 'Continue with GitHub' });
    expect(router.state.location.pathname).toBe('/signin');
    expect(new URLSearchParams(router.state.location.search).get('returnTo')).toBe(CURRENT_PATH);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Draft' })).not.toBeInTheDocument();
  });
});
