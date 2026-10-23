import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import { useSidebarHeaderSlots } from '../../domains/chat/components/useSidebarHeaderSlots';
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
      <Link to={`/factories/${FACTORY_ID}/user/new/draft-1`}>go-draft-1</Link>
    </main>
  );
}

function DraftPage() {
  return (
    <main>
      <h1>Draft</h1>
      <Link to={`/factories/${FACTORY_ID}/user/new/draft-2`}>go-draft-2</Link>
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

function SlotsPage() {
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout {...slots}>
      <h1>Slots page</h1>
    </PageLayout>
  );
}

function renderApp(initialPath = `/factories/${FACTORY_ID}/a`) {
  const router = createMemoryRouter(
    [
      {
        path: '/factories/:factoryId',
        element: <AppLayout />,
        children: [
          { path: 'a', element: <PageA /> },
          { path: 'b', element: <PageB /> },
          { path: 'slots', element: <SlotsPage /> },
          { path: 'user/new/:draftSessionId', element: <DraftPage /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
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

  it('leaves retired Factory pages out of the sidebar', async () => {
    stubFactory();
    renderApp();

    const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' });
    await within(sidebar).findByRole('navigation', { name: 'Factory' });
    for (const retired of ['Activity', 'Overview', 'Audit log', 'Supervisor']) {
      expect(within(sidebar).queryByRole('link', { name: new RegExp(`^${retired}`) })).not.toBeInTheDocument();
    }
  });

  it('shows one sidebar toggle: next to search while expanded, in the page header once collapsed', async () => {
    stubFactory();
    renderApp(`/factories/${FACTORY_ID}/slots`);

    const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' });
    await screen.findByRole('heading', { name: 'Slots page' });
    const [expandedToggle, ...extraWhileExpanded] = screen.getAllByRole('button', { name: 'Toggle sidebar' });
    expect(extraWhileExpanded).toHaveLength(0);
    expect(sidebar).toContainElement(expandedToggle);
    expect(expandedToggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(expandedToggle);

    await waitFor(() => expect(within(sidebar).queryByRole('button', { name: 'Toggle sidebar' })).toBeNull());
    const [collapsedToggle, ...extraWhileCollapsed] = screen.getAllByRole('button', { name: 'Toggle sidebar' });
    expect(extraWhileCollapsed).toHaveLength(0);
    expect(collapsedToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles the sidebar with [ but not on key repeat or while typing in a field', async () => {
    stubFactory();
    renderApp(`/factories/${FACTORY_ID}/slots`);

    await screen.findByRole('heading', { name: 'Slots page' });
    // The toggle moves between the sidebar and the page header, so look it up each time.
    const expanded = () => screen.getByRole('button', { name: 'Toggle sidebar' }).getAttribute('aria-expanded');
    expect(expanded()).toBe('true');

    await userEvent.keyboard('[[');
    await waitFor(() => expect(expanded()).toBe('false'));

    // Holding the key must not flip it back on auto-repeat.
    fireEvent.keyDown(document.body, { key: '[', repeat: true });
    expect(expanded()).toBe('false');

    await userEvent.keyboard('[[');
    await waitFor(() => expect(expanded()).toBe('true'));

    const field = document.createElement('input');
    document.body.append(field);
    await userEvent.type(field, '[[');
    expect(field).toHaveValue('[');
    expect(expanded()).toBe('true');
    field.remove();
  });

  it('keeps the shell mounted when switching between draft sessions', async () => {
    stubFactory();
    renderApp();

    const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' });
    await userEvent.click(screen.getByRole('link', { name: 'go-draft-1' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Draft' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('link', { name: 'go-draft-2' }));

    await waitFor(() => expect(screen.getByRole('link', { name: 'go-draft-2' })).toBeInTheDocument());
    expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBe(sidebar);
  });
});
