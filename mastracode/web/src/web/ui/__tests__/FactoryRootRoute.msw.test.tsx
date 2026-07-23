import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { createAppRoutes } from '../router';

function renderFactoryRoute(initialEntry = '/factories/fp-1') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [initialEntry] });
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

    const router = renderFactoryRoute();

    await waitFor(() => expect(router.state.location.pathname).toBe('/factories/fp-1/work'));
  });

  it('redirects the root route to onboarding when no factories exist', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })),
    );

    const router = renderFactoryRoute('/');

    await screen.findByRole('heading', { name: 'Build software with a Factory that knows your work.' });
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('redirects onboarding to the first factory when one exists', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Existing Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () =>
        HttpResponse.json({ workItems: [] }),
      ),
    );

    const router = renderFactoryRoute('/onboarding');

    await waitFor(() => expect(router.state.location.pathname).toBe('/factories/fp-1/work'));
  });

  it('keeps an in-progress onboarding flow open after its factory is created', async () => {
    sessionStorage.setItem('mastracode.factory-onboarding.step', 'project-management');
    sessionStorage.setItem('mastracode.factory-onboarding.factory-id', 'fp-1');

    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Pending Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
      ),
    );

    const router = renderFactoryRoute('/onboarding');

    try {
      await screen.findByRole('heading', { name: 'Connect the work behind the code.' });
      expect(router.state.location.pathname).toBe('/onboarding');
    } finally {
      sessionStorage.removeItem('mastracode.factory-onboarding.step');
      sessionStorage.removeItem('mastracode.factory-onboarding.factory-id');
    }
  });

  it('resumes a mid-flow onboarding from the root route after an OAuth round-trip', async () => {
    // GitHub/Linear callbacks land on `/?…=connected`; with the factory already
    // created mid-onboarding, the root route must resume the wizard instead of
    // landing on the factory home.
    sessionStorage.setItem('mastracode.factory-onboarding.step', 'project-management');
    sessionStorage.setItem('mastracode.factory-onboarding.factory-id', 'fp-1');

    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Pending Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, reason: 'ready' }),
      ),
    );

    const router = renderFactoryRoute('/?linear=connected');

    try {
      await screen.findByRole('heading', { name: 'Connect the work behind the code.' });
      expect(router.state.location.pathname).toBe('/onboarding');
    } finally {
      sessionStorage.removeItem('mastracode.factory-onboarding.step');
      sessionStorage.removeItem('mastracode.factory-onboarding.factory-id');
    }
  });

  it('ignores stale onboarding markers whose factory no longer exists', async () => {
    sessionStorage.setItem('mastracode.factory-onboarding.step', 'vcs');
    sessionStorage.setItem('mastracode.factory-onboarding.factory-id', 'fp-deleted');

    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Existing Factory' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () =>
        HttpResponse.json({ workItems: [] }),
      ),
    );

    const router = renderFactoryRoute('/');

    try {
      await waitFor(() => expect(router.state.location.pathname).toBe('/factories/fp-1/work'));
    } finally {
      sessionStorage.removeItem('mastracode.factory-onboarding.step');
      sessionStorage.removeItem('mastracode.factory-onboarding.factory-id');
    }
  });
});
