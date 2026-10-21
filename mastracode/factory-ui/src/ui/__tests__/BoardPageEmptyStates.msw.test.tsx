import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { closePropertiesMenus, openPropertiesMenu } from '../../../e2e/ui/properties-menu';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { confirmNewViewName, saveKanbanView } from './boardLayoutQueries';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

function renderBoard(search = '', board = 'work') {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/factories/${FACTORY_ID}/${board}${search}`],
  });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Board empty-state actions', () => {
  it('offers repository setup before rendering a Review board without repositories', async () => {
    stubWorkBoard();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
    );
    renderBoard('', 'review');

    expect(await screen.findByRole('heading', { name: 'Connect a repository to start reviewing' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Repository settings' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/repositories`,
    );
    expect(screen.queryByTestId('board-column-intake')).not.toBeInTheDocument();
  });

  it('shows a clear Review intake when a connected repository has no change requests', async () => {
    stubWorkBoard();
    renderBoard('', 'review');

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByText(/No change requests waiting/)).toBeVisible();
    expect(within(intake).queryByRole('link', { name: /Connect/ })).not.toBeInTheDocument();
    expect(within(intake).queryByRole('button', { name: 'Create card' })).not.toBeInTheDocument();
  });

  it.each(['list', 'board'])('offers manual creation and intake setup in the %s layout', async layout => {
    stubWorkBoard();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [] }),
      ),
    );
    renderBoard();
    const user = userEvent.setup();
    if (layout === 'board') await saveKanbanView(user);

    const intake = await screen.findByTestId('board-column-intake', {}, { timeout: 5000 });
    const create = await within(intake).findByRole('button', { name: 'Create card' });
    expect(within(intake).getByRole('link', { name: 'Connect issue source' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/intake`,
    );

    await user.click(create);
    const input = await screen.findByRole('textbox', { name: 'Work item title' });
    expect(input).toHaveFocus();
    expect(within(intake).queryByRole('button', { name: 'Create card' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await within(intake).findByRole('button', { name: 'Create card' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create work item in Intake' })).toHaveFocus();
  });

  it.each([
    { layout: 'list', search: '' },
    { layout: 'board', search: '' },
    { layout: 'list', search: '?source=manual' },
    { layout: 'board', search: '?source=manual' },
  ])('does not offer intake setup for an empty connected feed ($layout, $search)', async ({ layout, search }) => {
    stubWorkBoard();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: true, installations: [] }),
      ),
    );
    renderBoard(search);
    const user = userEvent.setup();
    if (layout === 'board' && search) {
      await screen.findByRole('button', { name: /^Board properties/ });
      await openPropertiesMenu(user, 'Board properties');
      await user.click(screen.getByRole('menuitem', { name: 'Save as view' }));
      await confirmNewViewName(user);
      await openPropertiesMenu(user, 'Board properties');
      expect(screen.getByRole('menuitem', { name: /^Intake source\s*Manual$/ })).toBeVisible();
      await closePropertiesMenus(user);
      await user.click(screen.getByRole('radio', { name: 'Board' }));
      await user.click(screen.getByRole('button', { name: 'Save to this view' }));
      await screen.findByRole('group', { name: 'Board columns' });
    } else if (layout === 'board') {
      await saveKanbanView(user);
    }

    const intake = await screen.findByTestId('board-column-intake');
    expect(await within(intake).findByRole('button', { name: 'Create card' })).toBeVisible();
    expect(within(intake).queryByRole('link', { name: 'Connect issue source' })).not.toBeInTheDocument();
    expect(within(intake).getByText(/Intake is clear/)).toBeVisible();
    expect(within(intake).queryByText(/No intake sources/)).not.toBeInTheDocument();
  });

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
    await confirmNewViewName(user);
    await user.type(screen.getByRole('searchbox', { name: 'Search cards' }), 'missing');

    const intake = screen.getByTestId('board-column-intake');
    await user.click(await within(intake).findByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Moved recently')).toBeVisible();
    expect(screen.getByText('Created later')).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Search cards' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save to this view' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset changes' }));
    await waitFor(() => expect(screen.queryByText('Moved recently')).not.toBeInTheDocument());
    expect(screen.getByText('Created later')).toBeVisible();
  });
});
