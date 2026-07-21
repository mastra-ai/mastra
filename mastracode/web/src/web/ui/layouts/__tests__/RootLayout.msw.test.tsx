import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/web-ui/render';
import { ProjectAccessGuard, RootLayout } from '../RootLayout';

function renderRoot(initialEntry: string) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, installations: [], reason: 'missing_config' }),
    ),
  );
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          {
            path: '',
            element: <ProjectAccessGuard />,
            children: [
              { path: 'unknown', element: <h1>Route-level not found</h1> },
              { path: 'onboarding', element: <h1>Onboarding</h1> },
            ],
          },
        ],
      },
      { path: '/signin', element: <h1>Sign in</h1> },
    ],
    { initialEntries: [initialEntry] },
  );
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

afterEach(() => localStorage.clear());

describe('RootLayout', () => {
  it('given no Factory is available, when the root route resolves, then it opens onboarding', async () => {
    localStorage.setItem('mastracode-factories', JSON.stringify([]));
    const router = renderRoot('/');

    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
  });

  it('given a non-root child route, when it renders, then root project resolution does not replace the child', async () => {
    renderRoot('/unknown');

    expect(await screen.findByRole('heading', { name: 'Route-level not found' })).toBeInTheDocument();
  });
});
