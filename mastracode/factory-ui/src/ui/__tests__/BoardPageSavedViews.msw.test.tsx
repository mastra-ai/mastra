import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

describe('Factory board saved views', () => {
  it('starts on All cards and offers layout controls for a custom view', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);
    const user = userEvent.setup();

    const views = await screen.findByRole('group', { name: 'Board views' });
    expect(within(views).getByRole('button', { name: 'All cards' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('radio', { name: 'Board' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Board filters' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filter cards' }));
    expect(screen.getByRole('combobox', { name: 'Add filter' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filter cards' }));
    expect(screen.queryByRole('group', { name: 'Board filters' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New view' }));
    expect(await screen.findByRole('radio', { name: 'Board' })).toBeChecked();
  });

  it('saves filters, sort and layout as a view that survives a reload with its filter editor collapsed', async () => {
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

    await screen.findByRole('button', { name: 'Untitled view', pressed: true });
    expect(screen.queryByRole('group', { name: 'View filters' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('group', { name: 'View filters' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All cards' }));
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    expect(screen.getByRole('group', { name: 'Board columns' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Board filters' })).not.toBeInTheDocument();
  });

  it('shows saved filters only while editing and hides them again on reset', async () => {
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

    const selectedView = screen.getByRole('button', { name: 'Untitled view', pressed: true });
    expect(screen.queryByRole('group', { name: 'View filters' })).not.toBeInTheDocument();
    await user.click(selectedView);
    await user.click(await screen.findByRole('menuitem', { name: 'Edit view' }));
    expect(
      within(screen.getByRole('group', { name: 'View filters' })).getByRole('button', { name: 'Remove Text filter' }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('group', { name: 'View filters' })).getByRole('button', { name: 'Clear filters' }),
    );
    await within(triage).findByText('Moved recently');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Untitled view', pressed: true })).toBe(selectedView);
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(within(triage).queryByText('Moved recently')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'View filters' })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Filter cards' }));
    await user.click(screen.getByRole('button', { name: 'Save as view' }));
    expect(within(screen.getByRole('group', { name: 'View filters' })).getByText('Created')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save view' }));

    await screen.findByRole('button', { name: 'Untitled view', pressed: true });
    expect(screen.queryByRole('button', { name: 'Save as view' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Sort filed cards/ }));
    expect(await screen.findByRole('menuitemradio', { name: 'Newest on board' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('searches within a saved view without changing its filters or entering the editor', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work?q=Created`],
    });
    renderWithProviders(<RouterProvider router={router} />);
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Created later');
    await user.click(screen.getByRole('button', { name: 'Filter cards' }));
    await user.click(screen.getByRole('button', { name: 'Save as view' }));
    await user.click(screen.getByRole('button', { name: 'Save view' }));
    const selectedView = screen.getByRole('button', { name: 'Untitled view', pressed: true });
    const search = screen.getByRole('searchbox', { name: 'Search cards' });

    await user.type(search, 'later');
    expect(within(triage).getByText('Created later')).toBeInTheDocument();
    expect(search).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Untitled view', pressed: true })).toBe(selectedView);
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'View filters' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'Moved');
    expect(within(triage).queryByText('Moved recently')).not.toBeInTheDocument();
    expect(within(triage).queryByText('Created later')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
    expect(within(triage).getByText('Created later')).toBeInTheDocument();

    await user.type(search, 'Moved');
    const boards = screen.getByRole('region', { name: 'Boards' });
    await user.click(within(boards).getByRole('link', { name: 'Review' }));
    await screen.findByTestId('board-column-review');
    await user.click(within(boards).getByRole('link', { name: 'Work' }));
    await within(await screen.findByTestId('board-column-triage')).findByText('Created later');
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Untitled view', pressed: true })).toBeInTheDocument();
  });

  it('clears a temporary search when switching views', async () => {
    stubWorkBoard();
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: [`/factories/${FACTORY_ID}/work`],
    });
    renderWithProviders(<RouterProvider router={router} />);
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');
    await user.click(screen.getByRole('button', { name: 'New view' }));
    await user.click(screen.getByRole('button', { name: 'Save view' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'Created');
    expect(within(triage).queryByText('Moved recently')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All cards' }));
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('');
    expect(within(triage).getByText('Moved recently')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'missing');
    expect(within(triage).queryByText('Created later')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as view' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Untitled view' }));
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('');
    expect(within(triage).getByText('Created later')).toBeInTheDocument();
  });
});

function readStage(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'stage' in body && typeof body.stage === 'string') {
    return body.stage;
  }
  throw new Error('Expected a transition body with a stage');
}

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
          const body: unknown = await request.json();
          const stage = readStage(body);
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
