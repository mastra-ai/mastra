import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { AppLayout } from '../AppLayout';

const FACTORY_ID = 'fp-1';

function stubFactory() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({ project: { id: FACTORY_ID, name: 'Acme Factory' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/supervisor/health`, () =>
      HttpResponse.json({ checkedAt: new Date().toISOString(), findings: [], counts: {} }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({}),
    ),
  );
}

function PageA() {
  return (
    <main>
      <h1>Page A</h1>
      <Link to={`/factories/${FACTORY_ID}/b`}>go-b</Link>
    </main>
  );
}

function PageB() {
  return (
    <main>
      <h1>Page B</h1>
    </main>
  );
}

function renderApp() {
  const router = createMemoryRouter(
    [
      {
        path: '/factories/:factoryId',
        element: <AppLayout />,
        children: [
          { path: 'a', element: <PageA /> },
          { path: 'b', element: <PageB /> },
        ],
      },
    ],
    { initialEntries: [`/factories/${FACTORY_ID}/a`] },
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('AppLayout', () => {
  it('renders the sidebar once and swaps only the outlet between routes', async () => {
    stubFactory();
    renderApp();

    const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' });
    expect(screen.getByRole('heading', { name: 'Page A' })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'Main sidebar' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('link', { name: 'go-b' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Page B' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Page A' })).not.toBeInTheDocument();
    // Same DOM node: the sidebar was not remounted by the navigation.
    expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBe(sidebar);
  });
});
