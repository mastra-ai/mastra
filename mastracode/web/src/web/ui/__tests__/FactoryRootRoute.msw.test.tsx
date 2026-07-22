import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { createAppRoutes } from '../router';

function renderFactoryRoot() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: ['/factories/fp-1'] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Factory root route', () => {
  it('redirects the bare factory URL to the work board', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Empty Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
    );

    const router = renderFactoryRoot();

    await waitFor(() => expect(router.state.location.pathname).toBe('/factories/fp-1/work'));
  });
});
