import { screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import { AuthGuard } from '../AuthGuard';

function renderGuard(authMe: () => Response | Promise<Response>) {
  server.use(http.get(`${TEST_BASE_URL}/auth/me`, authMe));
  const router = createMemoryRouter(
    [
      {
        element: <AuthGuard />,
        children: [{ path: '/private', element: <h1>Private project</h1> }],
      },
      { path: '/signin', element: <h1>Sign in route</h1> },
    ],
    { initialEntries: ['/private?tab=work#details'] },
  );
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('AuthGuard', () => {
  it('given authentication is pending, when a private route loads, then it shows the sign-in skeleton before rendering the route', async () => {
    renderGuard(async () => {
      await delay(100);
      return new Response(null, { status: 404 });
    });

    expect(await screen.findByRole('status', { name: 'Checking sign-in' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Private project' })).toBeInTheDocument();
  });

  it('given authentication is required, when an unauthenticated user opens a private route, then it preserves the full return path', async () => {
    const router = renderGuard(() => HttpResponse.json({ authenticated: false, user: null, authEnabled: true }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/signin'));
    expect(router.state.location.search).toBe('?returnTo=%2Fprivate%3Ftab%3Dwork%23details');
  });
});
