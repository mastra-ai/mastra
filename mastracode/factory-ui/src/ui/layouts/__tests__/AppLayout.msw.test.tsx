import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function stubRepository() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: 'repo-1',
                branch: 'main',
                sandboxWorkdir: '/workspace/acme',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
  );
}

function sidebarIsCollapsed() {
  return screen.getByRole('separator', { name: /^Resize sidebar/ }).getAttribute('aria-valuetext') === 'collapsed';
}

function mockMobileViewport() {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
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
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

describe('AppLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the sidebar once and swaps only the outlet between routes', async () => {
    stubFactory();
    renderApp();

    const sidebarBeforeNavigation = await screen.findByRole('complementary', { name: 'Main sidebar' });
    expect(screen.getByRole('heading', { name: 'Page A' })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'Main sidebar' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('link', { name: 'go-b' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Page B' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Page A' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Main sidebar' })).toBe(sidebarBeforeNavigation);
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

  it('shows one sidebar toggle: in the sidebar header while open, in the page header once collapsed', async () => {
    stubFactory();
    renderApp(`/factories/${FACTORY_ID}/slots`);

    const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' });
    await screen.findByRole('heading', { name: 'Slots page' });
    const [openToggle, ...extraWhileOpen] = screen.getAllByRole('button', { name: 'Toggle sidebar' });
    expect(extraWhileOpen).toHaveLength(0);
    expect(sidebar).toContainElement(openToggle);
    expect(openToggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(openToggle);

    await waitFor(() => expect(within(sidebar).queryByRole('button', { name: 'Toggle sidebar' })).toBeNull());
    const [collapsedToggle, ...extraWhileCollapsed] = screen.getAllByRole('button', { name: 'Toggle sidebar' });
    expect(extraWhileCollapsed).toHaveLength(0);
    expect(collapsedToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens a fresh draft from the sidebar New session button on every click', async () => {
    stubFactory();
    stubRepository();
    const { router } = renderApp();
    const draftPath = new RegExp(`^/factories/${FACTORY_ID}/user/new/[0-9a-f-]{36}$`);

    const sidebar = await screen.findByRole('complementary', { name: 'Main sidebar' });
    await userEvent.click(await within(sidebar).findByRole('button', { name: 'New session' }));

    await screen.findByRole('heading', { name: 'Draft' });
    const firstDraftPath = router.state.location.pathname;
    expect(firstDraftPath).toMatch(draftPath);

    await userEvent.click(within(sidebar).getByRole('button', { name: 'New session' }));

    await waitFor(() => expect(router.state.location.pathname).not.toBe(firstDraftPath));
    expect(router.state.location.pathname).toMatch(draftPath);
  });

  it('closes the mobile drawer once New session opens a draft', async () => {
    mockMobileViewport();
    stubFactory();
    stubRepository();
    const { router } = renderApp();

    await userEvent.click(await screen.findByRole('button', { name: 'Open navigation menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'New session' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(`/factories/${FACTORY_ID}/user/new/`));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument());
  });

  it('toggles the sidebar with [ but not on key repeat or while typing in a field', async () => {
    stubFactory();
    renderApp(`/factories/${FACTORY_ID}/slots`);

    await screen.findByRole('heading', { name: 'Slots page' });
    expect(sidebarIsCollapsed()).toBe(false);

    await userEvent.keyboard('[[');
    await waitFor(() => expect(sidebarIsCollapsed()).toBe(true));

    fireEvent.keyDown(document.body, { key: '[', repeat: true });
    expect(sidebarIsCollapsed()).toBe(true);

    await userEvent.keyboard('[[');
    await waitFor(() => expect(sidebarIsCollapsed()).toBe(false));

    const field = document.createElement('input');
    document.body.append(field);
    await userEvent.type(field, '[[');
    expect(field).toHaveValue('[');
    expect(sidebarIsCollapsed()).toBe(false);
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
