import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { closePropertiesMenus, openPropertiesMenu } from '../../../e2e/ui/properties-menu';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { saveKanbanView } from './boardLayoutQueries';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

function renderBoard(search = '', board = 'work') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/${board}${search}`],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Board empty-state actions', () => {
  it('clears all filters and temporary search together while preserving the sort', async () => {
    stubWorkBoard();
    const router = renderBoard('?search=also-missing&source=manual&sort=created-newest');
    const user = userEvent.setup();
    const intake = await screen.findByTestId('board-column-intake');

    await user.click(await within(intake).findByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Created later')).toBeVisible();
    expect(screen.getByText('Moved recently')).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('');
    expect(router.state.location.search).toBe('?sort=created-newest');
    expect(within(intake).queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('clears a saved view and search as an unsaved edit that can be reset', async () => {
    stubWorkBoard();
    renderBoard('?label=later');
    const user = userEvent.setup();
    await screen.findByText('Created later');
    await openPropertiesMenu(user, 'Board properties');
    await user.click(screen.getByRole('menuitem', { name: 'Save as view' }));
    await user.click(await screen.findByRole('button', { name: 'Save view' }));
    await screen.findByRole('button', { name: 'Untitled view', pressed: true });
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'missing');

    const intake = screen.getByTestId('board-column-intake');
    await user.click(await within(intake).findByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Moved recently')).toBeVisible();
    expect(screen.getByText('Created later')).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.queryByText('Moved recently')).not.toBeInTheDocument());
    expect(screen.getByText('Created later')).toBeVisible();
  });
});
