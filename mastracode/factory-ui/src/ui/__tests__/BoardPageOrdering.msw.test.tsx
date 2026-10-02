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

function workItem(id: string, title: string, createdAt: string, enteredAt: string, factoryProjectId = FACTORY_ID) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId,
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/work-items`, ({ params }) =>
      HttpResponse.json({
        workItems:
          params.factoryId === OTHER_FACTORY_ID
            ? [
                workItem(
                  'other-card',
                  'Other factory card',
                  '2026-08-01T00:00:00.000Z',
                  '2026-08-02T00:00:00.000Z',
                  OTHER_FACTORY_ID,
                ),
                workItem(
                  'other-moved-card',
                  'Other factory moved',
                  '2026-07-01T00:00:00.000Z',
                  '2026-08-04T00:00:00.000Z',
                  OTHER_FACTORY_ID,
                ),
              ]
            : [
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
  it('keeps the sort with the view tabs and the layout inside the view editor', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);
    const user = userEvent.setup();

    const viewControls = await screen.findByRole('group', { name: 'Board view controls' });
    expect(within(viewControls).getByRole('group', { name: 'Board filters' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Board' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sort filed cards' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Auto-start runs' })).toBeInTheDocument();
    const views = screen.getByRole('group', { name: 'Board views' });
    expect(within(views).getByRole('button', { name: 'All cards' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'New view' }));
    expect(await screen.findByRole('radio', { name: 'Board' })).toBeChecked();
  });

  it('saves filters, sort and layout as a view that survives a reload and keeps its filters on show', async () => {
    stubWorkBoard();
    const first = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work?q=Created&sort=created-newest`],
    });
    const firstView = renderWithProviders(<RouterProvider router={first} />);
    const user = userEvent.setup();
    const triageBeforeView = await screen.findByTestId('board-column-triage');
    await within(triageBeforeView).findByText('Created later');

    await user.click(screen.getByRole('button', { name: 'New view' }));
    const viewFilters = await screen.findByRole('group', { name: 'View filters' });
    await within(triageBeforeView).findByText('Moved recently');
    await user.type(within(viewFilters).getByRole('combobox', { name: 'Add filter' }), 'Created{Enter}{Escape}');
    await waitFor(() => expect(within(triageBeforeView).queryByText('Moved recently')).not.toBeInTheDocument());
    await user.click(screen.getByRole('radio', { name: 'List' }));
    await user.click(screen.getByRole('button', { name: 'Save view' }));

    const savedTab = await screen.findByRole('button', { name: 'Untitled view', pressed: true });
    expect(savedTab).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'View filters' })).getByText('Created')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save view' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Board columns' })).not.toBeInTheDocument();
    const viewId = new URLSearchParams(first.state.location.search).get('view');
    expect(viewId).toBeTruthy();
    firstView.unmount();

    const second = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work?view=${viewId}`],
    });
    renderWithProviders(<RouterProvider router={second} />);
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Created later');
    expect(within(triage).queryByText('Moved recently')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Board columns' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'View filters' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All cards' }));
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    expect(screen.getByRole('group', { name: 'Board columns' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Board filters' })).toBeInTheDocument();
  });

  it('narrows a saved view with temporary filters until they are saved or canceled', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work?q=Created`],
    });
    renderWithProviders(<RouterProvider router={router} />);
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Created later');
    await user.click(screen.getByRole('button', { name: 'New view' }));
    const viewFilters = await screen.findByRole('group', { name: 'View filters' });
    await user.type(within(viewFilters).getByRole('combobox', { name: 'Add filter' }), 'Created{Enter}{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save view' }));
    await screen.findByRole('button', { name: 'Untitled view', pressed: true });
    expect(screen.queryByRole('button', { name: 'Save view' })).not.toBeInTheDocument();

    await user.click(
      within(screen.getByRole('group', { name: 'View filters' })).getByRole('button', { name: 'Clear filters' }),
    );
    await within(triage).findByText('Moved recently');
    expect(screen.getByRole('button', { name: 'Save view' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(within(triage).queryByText('Moved recently')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Save view' })).not.toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('Created');
  });

  it('saves the board filters and sort in use as a new view', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work?q=Created&sort=created-newest`],
    });
    renderWithProviders(<RouterProvider router={router} />);
    const user = userEvent.setup();
    await within(await screen.findByTestId('board-column-triage')).findByText('Created later');

    await user.click(screen.getByRole('button', { name: 'Save as view' }));
    expect(within(screen.getByRole('group', { name: 'View filters' })).getByText('Created')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save view' }));

    await screen.findByRole('button', { name: 'Untitled view', pressed: true });
    expect(screen.queryByRole('button', { name: 'Save as view' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sort filed cards' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Newest on board' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('omits the personal sort when the session has no user identity', async () => {
    stubWorkBoard();
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json({ authenticated: true })));
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sort filed cards' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Recently moved' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryByRole('menuitemradio', { name: 'Recently moved by me' })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Sort filed cards' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Newest on board' }));

    await waitFor(() => {
      const titles = within(triage)
        .getAllByTestId('work-item-card')
        .map(card => card.textContent);
      expect(titles[0]).toContain('Created later');
      expect(titles[1]).toContain('Moved recently');
    });
    expect(router.state.location.search).toBe('?sort=created-newest');
    await user.click(screen.getByRole('button', { name: 'Sort filed cards' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Newest on board' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

function createDataTransfer() {
  const values = new Map<string, string>();
  const types: string[] = [];
  return {
    types,
    effectAllowed: 'uninitialized',
    dropEffect: 'none',
    setData(type: string, value: string) {
      values.set(type, value);
      if (!types.includes(type)) types.push(type);
    },
    getData(type: string) {
      return values.get(type) ?? '';
    },
  };
}

describe('Factory board list layout', () => {
  const openListBoard = async () => {
    stubWorkBoard();
    const transitions: { itemId: string; stage: string }[] = [];
    server.use(
      http.post(
        `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/:itemId/transition`,
        async ({ params, request }) => {
          const { stage } = (await request.json()) as { stage: string };
          transitions.push({ itemId: String(params.itemId), stage });
          return HttpResponse.json({
            result: {
              status: 'accepted',
              transitionId: 'transition-1',
              itemId: params.itemId,
              revision: 2,
              stage,
              decisions: [],
            },
          });
        },
      ),
    );
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New view' }));
    await user.click(await screen.findByRole('radio', { name: 'List' }));
    await user.click(screen.getByRole('button', { name: 'Save view' }));
    const triage = await screen.findByTestId('board-column-triage');
    const title = await within(triage).findByText('Moved recently');
    const row = title.closest<HTMLElement>('[data-testid="work-item-card"]');
    if (!row) throw new Error('Expected the title inside its list row');
    return { row, transitions };
  };

  it('opens a row from its expand button and from a click anywhere on the row', async () => {
    const { row } = await openListBoard();
    const user = userEvent.setup();

    await user.click(within(row).getByRole('button', { name: 'Details for Moved recently' }));
    expect(await screen.findByRole('dialog', { name: 'Moved recently' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Moved recently' })).not.toBeInTheDocument());

    await user.click(within(row).getByText('Moved recently'));
    expect(await screen.findByRole('dialog', { name: 'Moved recently' })).toBeInTheDocument();
  });

  it('moves a row into another stage when it is dropped on that group', async () => {
    const { row, transitions } = await openListBoard();
    const planning = screen.getByTestId('board-column-planning');
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(row, { dataTransfer });
    fireEvent.dragOver(planning, { dataTransfer });
    expect(dataTransfer.dropEffect).toBe('move');
    fireEvent.drop(planning, { dataTransfer });

    await waitFor(() => expect(transitions).toEqual([{ itemId: 'recent-card', stage: 'planning' }]));
  });

  it('offers the card actions on right-click', async () => {
    const { row, transitions } = await openListBoard();
    const user = userEvent.setup();

    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole('menuitem', { name: 'Mark done' }));

    await waitFor(() => expect(transitions).toEqual([{ itemId: 'recent-card', stage: 'done' }]));
    expect(screen.queryByRole('dialog', { name: 'Moved recently' })).not.toBeInTheDocument();
  });

  it('starts a new view with the active view layout', async () => {
    await openListBoard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'New view' }));

    expect(await screen.findByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.queryByRole('group', { name: 'Board columns' })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Sort filed cards' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Newest on board' }));
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
    const otherTriage = await screen.findByTestId('board-column-triage');
    // The first factory's search isn't applied here: both of this factory's own cards show.
    await within(otherTriage).findByText('Other factory card');
    expect(within(otherTriage).getByText('Other factory moved')).toBeInTheDocument();
    expect(within(otherTriage).queryByText('Created later')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    await searchBoard('Moved');
    await waitFor(() => expect(router.state.location.search).toBe('?q=Moved'));
    await waitFor(() => expect(within(otherTriage).queryByText('Other factory card')).not.toBeInTheDocument());

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
