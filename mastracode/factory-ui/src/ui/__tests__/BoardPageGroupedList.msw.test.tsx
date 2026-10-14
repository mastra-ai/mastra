import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

function renderBoard() {
  stubWorkBoard();
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

describe('Default grouped issue list', () => {
  it('collapses groups independently and expands them with the keyboard', async () => {
    renderBoard();
    const user = userEvent.setup();
    const list = await screen.findByLabelText('Board stages');
    const triage = within(list).getByTestId('board-column-triage');
    const title = await within(triage).findByText('Moved recently');
    expect(title).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Board columns' })).not.toBeInTheDocument();

    await user.click(within(triage).getByRole('button', { name: 'Collapse Triage' }));
    const toggle = within(triage).getByRole('button', { name: 'Expand Triage' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(toggle).getByText('2')).toBeVisible();
    await waitFor(() => expect(title).not.toBeVisible());
    expect(screen.getByRole('button', { name: 'Collapse Planning' })).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(title).toBeVisible());
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(title).not.toBeVisible());
  });

  it('reveals the composer when creating an issue in a collapsed group', async () => {
    renderBoard();
    const user = userEvent.setup();
    await screen.findByText('Moved recently');
    await user.click(screen.getByRole('button', { name: 'Collapse Triage' }));
    await user.click(screen.getByRole('button', { name: 'Create work item in Triage' }));

    const titleInput = await screen.findByRole('textbox', { name: 'Work item title' });
    expect(titleInput).toBeVisible();
    expect(titleInput).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Collapse Triage' })).toHaveAttribute('aria-expanded', 'true');
    await user.type(titleInput, 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Collapse Triage' }));
    await user.click(screen.getByRole('button', { name: 'Expand Triage' }));
    expect(titleInput).toHaveValue('Keep this draft');
  });

  it('reveals a linked issue in a collapsed group without expanding other groups', async () => {
    const router = renderBoard();
    const user = userEvent.setup();
    await screen.findByText('Moved recently');
    await user.click(screen.getByRole('button', { name: 'Collapse Triage' }));
    await user.click(screen.getByRole('button', { name: 'Collapse Planning' }));

    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?item=recent-card`));

    expect(await screen.findByRole('button', { name: 'Collapse Triage' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Expand Planning' })).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.getByText('Moved recently')).toBeVisible());
  });
});
