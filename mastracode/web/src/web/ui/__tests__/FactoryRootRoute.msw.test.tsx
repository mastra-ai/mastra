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

// Literal keys on purpose: these tests pin the sessionStorage contract the
// guard and RootLanding rely on across full-page OAuth redirects.
function seedOnboarding(step: string, factoryId: string, updatedAt: number | null = Date.now()) {
  sessionStorage.setItem('mastracode.factory-onboarding.step', step);
  sessionStorage.setItem('mastracode.factory-onboarding.factory-id', factoryId);
  if (updatedAt !== null) sessionStorage.setItem('mastracode.factory-onboarding.updated-at', String(updatedAt));
}

function clearOnboarding() {
  sessionStorage.removeItem('mastracode.factory-onboarding.step');
  sessionStorage.removeItem('mastracode.factory-onboarding.factory-id');
  sessionStorage.removeItem('mastracode.factory-onboarding.updated-at');
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
    seedOnboarding('project-management', 'fp-1');

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
      clearOnboarding();
    }
  });

  it('resumes a mid-flow onboarding from the root route after an OAuth round-trip', async () => {
    // GitHub/Linear callbacks land on `/?…=connected`; with the factory already
    // created mid-onboarding, the root route must resume the wizard instead of
    // landing on the factory home.
    seedOnboarding('project-management', 'fp-1');

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
      clearOnboarding();
    }
  });

  it('ignores stale onboarding markers whose factory no longer exists', async () => {
    // Fresh timestamp: this test pins the factory-existence gate specifically.
    seedOnboarding('vcs', 'fp-deleted');

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
      clearOnboarding();
    }
  });

  it('treats onboarding markers without a fresh timestamp as abandoned', async () => {
    // Markers written by an older version of the flow (or a tab rediscovered
    // hours later) have no fresh `updated-at`: with a factory existing they
    // must bounce to it instead of re-opening the wizard.
    seedOnboarding('vcs', 'fp-1', null);

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

    try {
      await waitFor(() => expect(router.state.location.pathname).toBe('/factories/fp-1/work'));
    } finally {
      clearOnboarding();
    }
  });
});
