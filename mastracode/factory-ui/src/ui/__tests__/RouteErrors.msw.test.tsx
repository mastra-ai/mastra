import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

function FailingPage(): never {
  throw new Error('Unexpected page rendering failure');
}

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:sessionId/permissions`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () => HttpResponse.json({ enabled: false, connected: false })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({ config: { github: { enabled: false }, linear: { enabled: false } } }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
  );
});

const RULES_PATH = '/factories/fp-1/rules';

function renderFailingPage() {
  const routes = createAppRoutes();
  const rules = matchRoutes(routes, RULES_PATH)?.at(-1)?.route;
  if (!rules) throw new Error(`No route renders ${RULES_PATH}`);
  rules.element = <FailingPage />;
  const router = createMemoryRouter(routes, { initialEntries: [RULES_PATH] });
  renderWithProviders(<RouterProvider router={router} />);
}

describe('when a page throws during rendering', () => {
  it('lets users reopen a persisted collapsed sidebar and return to Work', async () => {
    localStorage.setItem('mastracode-web:sidebar:state', 'collapsed');
    renderFailingPage();

    await screen.findByRole('heading', { name: 'Something went wrong' });
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('link', { name: 'Work' }));

    expect(await screen.findByRole('heading', { name: 'Connect a repository to start intake' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload page' })).not.toBeInTheDocument();
  });
});
