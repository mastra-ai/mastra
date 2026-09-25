import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';
const OTHER_FACTORY_ID = 'fp-2';

function workItem(id: string, title: string, createdAt: string, enteredAt: string) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    board: 'work',
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['triage'],
    stageHistory: [{ stage: 'triage', enteredAt, by: 'user-1' }],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

function stubWorkBoard() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: FACTORY_ID, name: 'Acme Factory' },
          { id: OTHER_FACTORY_ID, name: 'Other Factory' },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/work-items`, () =>
      HttpResponse.json({
        workItems: [
          workItem('newer-card', 'Created later', '2026-08-02T00:00:00.000Z', '2026-08-03T00:00:00.000Z'),
          workItem('recent-card', 'Moved recently', '2026-07-01T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/decisions`, () => HttpResponse.json({ decisions: [] })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: false, sourceIds: null }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/incidentio/status`, () => HttpResponse.json({ enabled: false, configured: false })),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings: [] })),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/prs`, () =>
      HttpResponse.json({ pullRequests: [], nextPage: null }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/permissions`, () =>
      HttpResponse.json({ permissions: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/source-control/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [] }),
    ),
  );
}

describe('Factory board ordering', () => {
  it('groups filtering and sorting separately from board automation', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);

    const viewControls = await screen.findByRole('group', { name: 'Board view controls' });
    expect(within(viewControls).getByRole('group', { name: 'Board filters' })).toBeInTheDocument();
    expect(within(viewControls).getByRole('combobox', { name: 'Sort filed cards' })).toBeInTheDocument();
    expect(within(viewControls).queryByRole('switch', { name: 'Auto-start runs' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Auto-start runs' })).toBeInTheDocument();
  });

  it('renders the card most recently moved into a column before a newer-created card', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);

    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');
    const titles = within(triage)
      .getAllByTestId('work-item-card')
      .map(card => card.textContent);

    expect(titles[0]).toContain('Moved recently');
    expect(titles[1]).toContain('Created later');
  });

  it('updates the URL and rendered column order when the sort changes', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work?sort=created-oldest`],
    });
    renderWithProviders(<RouterProvider router={router} />);

    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Sort filed cards' }));
    await user.click(await screen.findByRole('option', { name: 'Newest on board' }));

    await waitFor(() => {
      const titles = within(triage)
        .getAllByTestId('work-item-card')
        .map(card => card.textContent);
      expect(titles[0]).toContain('Created later');
      expect(titles[1]).toContain('Moved recently');
    });
    expect(router.state.location.search).toBe('?sort=created-newest');
    expect(screen.getByRole('combobox', { name: 'Sort filed cards' })).toHaveTextContent(
      'Filed cards: Newest on board',
    );
  });
});

describe('Factory board view memory', () => {
  const openWorkBoard = (search = '') => {
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work${search}`],
    });
    const view = renderWithProviders(<RouterProvider router={router} />);
    return { router, view };
  };

  const searchBoard = async (text: string) => {
    const input = await screen.findByRole('combobox', { name: 'Add filter' });
    input.focus();
    fireEvent.change(input, { target: { value: text } });
    await screen.findByRole('option', { name: new RegExp(`contains "${text}"`) });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    input.blur();
  };

  it('brings back filters and sort when the board is reopened without them', async () => {
    stubWorkBoard();
    const first = openWorkBoard();
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');

    await searchBoard('Created');
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Sort filed cards' }));
    await user.click(await screen.findByRole('option', { name: 'Newest on board' }));
    await waitFor(() => expect(first.router.state.location.search).toBe('?q=Created&sort=created-newest'));
    first.view.unmount();

    const second = openWorkBoard();
    const reopened = await screen.findByTestId('board-column-triage');
    // The saved view applies on the board's first render, so the filtered-out card is never shown.
    await within(reopened).findByText('Created later');
    expect(within(reopened).queryByText('Moved recently')).not.toBeInTheDocument();
    await waitFor(() => expect(second.router.state.location.search).toBe('?q=Created&sort=created-newest'));
  });

  it('keeps an explicit URL and card deep links as they are', async () => {
    stubWorkBoard();
    const first = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(first.router.state.location.search).toBe('?q=Created'));
    first.view.unmount();

    const explicit = openWorkBoard('?sort=created-oldest');
    await screen.findByTestId('board-column-triage');
    expect(explicit.router.state.location.search).toBe('?sort=created-oldest');
    explicit.view.unmount();

    const deepLink = openWorkBoard('?item=recent-card');
    await screen.findByTestId('board-column-triage');
    expect(deepLink.router.state.location.search).toBe('?item=recent-card');
  });

  it('forgets the filters once they are cleared', async () => {
    stubWorkBoard();
    const first = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(first.router.state.location.search).toBe('?q=Created'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(first.router.state.location.search).toBe(''));
    first.view.unmount();

    const second = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    expect(second.router.state.location.search).toBe('');
  });

  it('keeps a separate view for each factory while the board stays mounted', async () => {
    stubWorkBoard();
    const { router } = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created'));

    await act(() => router.navigate(`/factories/${OTHER_FACTORY_ID}/work`));
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    expect(router.state.location.search).toBe('');
    await searchBoard('Moved');
    await waitFor(() => expect(router.state.location.search).toBe('?q=Moved'));

    await act(() => router.navigate(`/factories/${FACTORY_ID}/work`));
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created'));
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Created later');
    expect(within(triage).queryByText('Moved recently')).not.toBeInTheDocument();
  });

  it('keeps a separate view for each board', async () => {
    stubWorkBoard();
    const { router } = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created'));

    await act(() => router.navigate(`/factories/${FACTORY_ID}/review`));
    await screen.findByRole('combobox', { name: 'Add filter' });
    expect(router.state.location.search).toBe('');

    await act(() => router.navigate(`/factories/${FACTORY_ID}/work`));
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created'));
  });
});
