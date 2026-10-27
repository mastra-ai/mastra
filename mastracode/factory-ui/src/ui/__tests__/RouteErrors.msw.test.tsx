import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { FactoryLayout } from '../domains/workspaces/components/FactoryLayout';
import { AppLayout } from '../layouts/AppLayout';
import { AppRouteErrorPage, RouteErrorPage } from '../layouts/RouteErrorPage';
import { WorkBoardPage } from '../pages/BoardPage';

// Asset failures run against the production build in e2e/production/route-errors.spec.ts.
// This test route exercises ordinary render errors without replacing app modules.
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

function renderAt(path = '/factories/fp-1/error') {
  const router = createMemoryRouter(
    [
      {
        path: '/factories/:factoryId',
        element: <FactoryLayout />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                errorElement: <AppRouteErrorPage />,
                children: [
                  { path: 'error', Component: FailingPage },
                  { path: 'work', Component: WorkBoardPage },
                ],
              },
            ],
          },
        ],
      },
      { path: '/standalone', Component: FailingPage, errorElement: <RouteErrorPage /> },
    ],
    { initialEntries: [path] },
  );
  renderWithProviders(<RouterProvider router={router} />);
}

describe('ordinary page errors', () => {
  describe('when a page throws during rendering', () => {
    it('shows a recoverable error for ordinary page failures without calling them loading errors', async () => {
      renderAt();

      expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
      expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Could not load this page' })).not.toBeInTheDocument();
      expect(screen.queryByText('Unexpected Application Error!')).not.toBeInTheDocument();
    });

    it('lets users reopen a persisted collapsed sidebar and return to Work after a page fails', async () => {
      localStorage.setItem('mastracode-web:sidebar:state', 'collapsed');
      renderAt();

      await screen.findByRole('heading', { name: 'Something went wrong' });
      const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(toggle);
      await userEvent.click(screen.getByRole('link', { name: 'Work' }));

      expect(await screen.findByRole('heading', { name: 'Connect a repository to start intake' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reload page' })).not.toBeInTheDocument();
    });

    it('offers recovery outside the app without requiring sidebar context', async () => {
      renderAt('/standalone');

      expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
      expect(screen.queryByText('Unexpected Application Error!')).not.toBeInTheDocument();
    });
  });
});
