import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

const ROW_HOVER_REVEAL = [
  'pointer-fine:group-hover/data-list-row:opacity-100',
  'pointer-fine:group-hover/data-list-row:pointer-events-auto',
  'pointer-fine:group-has-[:focus-visible]/data-list-row:opacity-100',
];

function renderBoard() {
  stubWorkBoard();
  const transitions: { itemId: string; body: Record<string, unknown> }[] = [];
  server.use(
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items/:itemId/transition`,
      async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        transitions.push({ itemId: String(params.itemId), body });
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: `transition-${transitions.length}`,
            itemId: String(params.itemId),
            revision: 9,
            stage: body.stage,
            decisions: [],
          },
        });
      },
    ),
  );
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  renderWithProviders(<RouterProvider router={router} />);
  return { transitions };
}

describe('List row actions menu', () => {
  it('reveals the actions and details buttons on hover or keyboard focus of any row, not only the selected one', async () => {
    renderBoard();
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');

    for (const name of ['Actions for Moved recently', 'Details for Moved recently', 'Actions for Created later']) {
      const button = within(triage).getByRole('button', { name });
      expect(button).toHaveClass(...ROW_HOVER_REVEAL);
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves an unselected card in two clicks without opening its details', async () => {
    const { transitions } = renderBoard();
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');

    await user.click(within(triage).getByRole('button', { name: 'Actions for Moved recently' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to Planning' }));

    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]).toMatchObject({ itemId: 'recent-card', body: { stage: 'planning' } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(triage).getByRole('button', { name: 'Details for Moved recently' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens the actions menu from the keyboard on a row that is not selected', async () => {
    renderBoard();
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    await within(triage).findByText('Moved recently');

    const trigger = within(triage).getByRole('button', { name: 'Actions for Created later' });
    act(() => trigger.focus());
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('menuitem', { name: 'Move to Planning' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the same actions menu on right-click without selecting the row', async () => {
    renderBoard();
    const triage = await screen.findByTestId('board-column-triage');
    const row = await within(triage).findByRole('article', { name: 'Moved recently' });

    fireEvent.contextMenu(row);

    expect(await screen.findByRole('menuitem', { name: 'Move to Planning' })).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
