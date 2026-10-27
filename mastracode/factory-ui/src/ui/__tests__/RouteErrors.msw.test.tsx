import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

// Vitest loads page modules from disk. Reject at that boundary to simulate
// unavailable browser chunks; the router, layouts, guards, and data hooks stay real.
vi.mock('../pages/SettingsPage', () => ({
  get SettingsPage() {
    throw new TypeError('Failed to fetch dynamically imported module: /assets/SettingsPage-old.js');
  },
}));
vi.mock('../pages/ThreadPage', () => ({
  get ThreadPage() {
    throw new TypeError('error loading dynamically imported module: /assets/ThreadPage-old.js');
  },
}));
vi.mock('../pages/OnboardingPage', () => ({
  get OnboardingPage() {
    throw new TypeError('Importing a module script failed.');
  },
}));
vi.mock('../pages/SignInPage', () => ({
  get SignInPage() {
    throw new Error('Unable to preload CSS for /assets/SignInPage-old.css');
  },
}));
vi.mock('../pages/RulesPage', () => ({
  RulesPage() {
    throw new Error('Unexpected page rendering failure');
  },
}));

const WORK_PATH = '/factories/fp-1/work';

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () =>
      HttpResponse.json({ error: 'Session not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/permissions`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ config: { github: { enabled: false }, linear: { enabled: false } } }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
  );
});

function renderAt(path: string) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [path] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

async function expectLoadRecovery() {
  expect(await screen.findByRole('heading', { name: 'Could not load this page' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  expect(screen.queryByText('Unexpected Application Error!')).not.toBeInTheDocument();
}

describe('unavailable page chunks', () => {
  const routes = [
    { name: 'Settings (React.lazy)', path: '/factories/fp-1/settings/preferences' },
    { name: 'a session (route.lazy)', path: '/factories/fp-1/workspaces/session-1/threads/thread-1' },
  ];

  it.each(routes)('keeps the sidebar and offers reload on a direct link to $name', async ({ path }) => {
    renderAt(path);

    await expectLoadRecovery();
    expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBeInTheDocument();
  });

  it.each(routes)('preserves the sidebar when opening $name and lets the user return to Work', async ({ path }) => {
    const router = renderAt(WORK_PATH);
    await screen.findByRole('heading', { name: 'Connect a repository to start intake' });
    const sidebar = screen.getByRole('complementary', { name: 'Main sidebar' });

    await act(() => router.navigate(path));

    await expectLoadRecovery();
    expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBe(sidebar);

    await act(() => router.navigate(WORK_PATH));

    await screen.findByRole('heading', { name: 'Connect a repository to start intake' });
    expect(screen.queryByRole('button', { name: 'Reload page' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBe(sidebar);
  });

  it('offers reload when the sign-in stylesheet cannot load', async () => {
    renderAt('/signin');
    await expectLoadRecovery();
  });

  it('offers reload when onboarding cannot load', async () => {
    server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })));
    renderAt('/onboarding');
    await expectLoadRecovery();
  });

  it('shows a recoverable error for ordinary page failures without calling them loading errors', async () => {
    renderAt('/factories/fp-1/rules');

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Could not load this page' })).not.toBeInTheDocument();
    expect(screen.queryByText('Unexpected Application Error!')).not.toBeInTheDocument();
  });

  it('lets users reopen a persisted collapsed sidebar and return to Work after a page fails', async () => {
    localStorage.setItem('mastracode-web:sidebar:state', 'collapsed');
    renderAt('/factories/fp-1/rules');

    await screen.findByRole('heading', { name: 'Something went wrong' });
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('link', { name: 'Work' }));

    expect(await screen.findByRole('heading', { name: 'Connect a repository to start intake' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload page' })).not.toBeInTheDocument();
  });
});
