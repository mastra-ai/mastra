import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

function renderAt(url: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [url] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Connections entry (/settings/connections)', () => {
  it('forwards to the first Factory Connections settings', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'First Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
    );

    const router = renderAt('/settings/connections');

    await waitFor(() => expect(router.state.location.pathname).toBe('/factories/fp-1/settings/connections'));
  });
});
