import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { FactoryLayout } from '../domains/workspaces/components/FactoryLayout';
import { AppLayout } from '../layouts/AppLayout';
import { AppRouteErrorPage } from '../layouts/RouteErrorPage';
import { WorkBoardPage } from '../pages/BoardPage';

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

function renderFailingPage() {
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
    ],
    { initialEntries: ['/factories/fp-1/error'] },
  );
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
