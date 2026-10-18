import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { FACTORY_ID, OTHER_FACTORY_ID, stubWorkBoard } from './workBoardStubs';

describe('Factory board ordering', () => {
  it('omits the personal sort when the session has no user identity', async () => {
    stubWorkBoard();
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json({ authenticated: true })));
    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
    renderWithProviders(<RouterProvider router={router} />);
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Sort filed cards/ }));
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
    await user.click(screen.getByRole('button', { name: /^Sort filed cards/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Newest on board' }));

    await waitFor(() => {
      const titles = within(triage)
        .getAllByTestId('work-item-card')
        .map(card => card.textContent);
      expect(titles[0]).toContain('Created later');
      expect(titles[1]).toContain('Moved recently');
    });
    expect(router.state.location.search).toBe('?sort=created-newest');
    await user.click(screen.getByRole('button', { name: 'Sort filed cards: Newest on board' }));
    expect(await screen.findByRole('menuitemradio', { name: 'Newest on board' })).toHaveAttribute(
      'aria-checked',
      'true',
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
    if (!screen.queryByRole('combobox', { name: 'Add filter' })) {
      fireEvent.click(await screen.findByRole('button', { name: 'Filter cards' }));
    }
    const input = screen.getByRole('combobox', { name: 'Add filter' });
    input.focus();
    fireEvent.change(input, { target: { value: text } });
    await screen.findByRole('option', { name: new RegExp(`contains "${text}"`) });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    input.blur();
  };

  const sidebarBoardLink = (name: 'Work' | 'Review') =>
    within(screen.getByRole('region', { name: 'Boards' })).getByRole('link', { name });

  const leaveForReviewBoard = async () => {
    fireEvent.click(sidebarBoardLink('Review'));
    await screen.findByTestId('board-column-review');
  };

  it('brings back filters and sort when the board is reopened from the sidebar', async () => {
    stubWorkBoard();
    const { router } = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Sort filed cards/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Newest on board' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created&sort=created-newest'));
    await leaveForReviewBoard();

    const workLink = sidebarBoardLink('Work');
    expect(workLink).toHaveAttribute('href', `/factories/${FACTORY_ID}/work?q=Created&sort=created-newest`);
    fireEvent.click(workLink);

    const reopened = await screen.findByTestId('board-column-triage');
    await within(reopened).findByText('Created later');
    expect(within(reopened).queryByText('Moved recently')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=Created&sort=created-newest');
  });

  it('opens a board link exactly as linked', async () => {
    stubWorkBoard();
    const first = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(first.router.state.location.search).toBe('?q=Created'));
    first.view.unmount();

    const bare = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    expect(bare.router.state.location.search).toBe('');
    bare.view.unmount();

    const explicit = openWorkBoard('?sort=created-oldest');
    await screen.findByTestId('board-column-triage');
    expect(explicit.router.state.location.search).toBe('?sort=created-oldest');
    explicit.view.unmount();

    const deepLink = openWorkBoard('?item=recent-card');
    await screen.findByTestId('board-column-triage');
    expect(deepLink.router.state.location.search).toBe('?item=recent-card');
  });

  it('lands on the remembered view when the factory is opened', async () => {
    stubWorkBoard();
    const first = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(first.router.state.location.search).toBe('?q=Created'));
    first.view.unmount();

    const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}`] });
    renderWithProviders(<RouterProvider router={router} />);

    await within(await screen.findByTestId('board-column-triage')).findByText('Created later');
    expect(router.state.location.pathname).toBe(`/factories/${FACTORY_ID}/work`);
    expect(router.state.location.search).toBe('?q=Created');
  });

  it('forgets the filters once they are cleared', async () => {
    stubWorkBoard();
    const { router } = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await userEvent.keyboard('{Escape}');
    await leaveForReviewBoard();

    expect(sidebarBoardLink('Work')).toHaveAttribute('href', `/factories/${FACTORY_ID}/work`);
  });

  it('keeps a separate view for each factory when switching factories', async () => {
    stubWorkBoard();
    const { router } = openWorkBoard();
    await within(await screen.findByTestId('board-column-triage')).findByText('Moved recently');
    await searchBoard('Created');
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created'));
    const user = userEvent.setup();
    const switchFactory = async (name: string) => {
      await user.click(screen.getByRole('button', { name: 'Select factory' }));
      await user.click(await screen.findByRole('menuitem', { name }));
    };

    await switchFactory('Other Factory');
    await waitFor(() => expect(router.state.location.pathname).toBe(`/factories/${OTHER_FACTORY_ID}/work`));
    const otherTriage = await screen.findByTestId('board-column-triage');
    await within(otherTriage).findByText('Other factory card');
    expect(within(otherTriage).getByText('Other factory moved')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    await searchBoard('Moved');
    await waitFor(() => expect(router.state.location.search).toBe('?q=Moved'));

    await switchFactory('Acme Factory');
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

    await leaveForReviewBoard();
    expect(router.state.location.search).toBe('');

    fireEvent.click(sidebarBoardLink('Work'));
    await waitFor(() => expect(router.state.location.search).toBe('?q=Created'));
  });
});
