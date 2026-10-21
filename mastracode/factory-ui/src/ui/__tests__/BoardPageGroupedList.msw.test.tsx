import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { saveKanbanView, stageToggle } from './boardLayoutQueries';
import { FACTORY_ID, stubWorkBoard, workItem } from './workBoardStubs';

function renderBoard() {
  stubWorkBoard();
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  renderWithProviders(<RouterProvider router={router} />);
  return router;
}

function stubManualCreate(title: string) {
  const created = {
    id: 'manual-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    board: 'work',
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['intake'],
    stageHistory: [{ stage: 'intake', enteredAt: '2026-08-05T00:00:00.000Z', by: 'user-1' }],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
  let stored = false;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: stored ? [created] : [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => {
      stored = true;
      return HttpResponse.json({ workItem: created });
    }),
  );
}

describe('Default grouped issue list', () => {
  it('creates the first card directly from the empty state without an intake source', async () => {
    renderBoard();
    stubManualCreate('My first card');
    const user = userEvent.setup();
    const intake = await screen.findByTestId('board-column-intake');

    await user.click(await within(intake).findByRole('button', { name: 'Create card' }));
    await user.type(await screen.findByRole('textbox', { name: 'Work item title' }), 'My first card');
    await user.click(screen.getByRole('button', { name: 'Add work item to Intake' }));

    const created = await within(intake).findByText('My first card');
    await waitFor(() => expect(created).toBeVisible());
    expect(within(intake).queryByRole('button', { name: 'Create card' })).not.toBeInTheDocument();
  });

  it('collapses groups independently and expands them with the keyboard', async () => {
    renderBoard();
    const user = userEvent.setup();
    const list = await screen.findByLabelText('Board stages');
    const triage = within(list).getByTestId('board-column-triage');
    const title = await within(triage).findByText('Moved recently');
    expect(title).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Board columns' })).not.toBeInTheDocument();

    const toggle = stageToggle('Triage', triage);
    expect(toggle).toHaveAccessibleName('Triage, 2');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(title).not.toBeVisible());
    expect(stageToggle('Planning')).toHaveAttribute('aria-expanded', 'true');

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
    await user.click(stageToggle('Triage'));
    await user.click(screen.getByRole('button', { name: 'Create work item in Triage' }));

    const titleInput = await screen.findByRole('textbox', { name: 'Work item title' });
    expect(titleInput).toBeVisible();
    expect(titleInput).toHaveFocus();
    expect(stageToggle('Triage')).toHaveAttribute('aria-expanded', 'true');
    await user.type(titleInput, 'Keep this draft');
    await user.click(stageToggle('Triage'));
    await user.click(stageToggle('Triage'));
    expect(titleInput).toHaveValue('Keep this draft');
  });

  it('keeps a collapsed group open after the issue created in it is saved', async () => {
    renderBoard();
    stubManualCreate('Filed while folded');
    const user = userEvent.setup();
    const intake = await screen.findByTestId('board-column-intake');
    await waitFor(() => expect(within(intake).queryByRole('status')).not.toBeInTheDocument());
    await user.click(stageToggle('Intake', intake));
    await user.click(screen.getByRole('button', { name: 'Create work item in Intake' }));
    await user.type(await screen.findByRole('textbox', { name: 'Work item title' }), 'Filed while folded');
    await user.click(screen.getByRole('button', { name: 'Add work item to Intake' }));

    await waitFor(() => expect(screen.queryByRole('form', { name: 'New work item in Intake' })).toBeNull());
    const created = await within(intake).findByText('Filed while folded');
    expect(stageToggle('Intake', intake)).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(created).toBeVisible());
  });

  it('reveals a linked issue in a collapsed group without expanding other groups', async () => {
    const router = renderBoard();
    const user = userEvent.setup();
    await screen.findByText('Moved recently');
    await user.click(stageToggle('Triage'));
    await user.click(stageToggle('Planning'));

    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?item=recent-card`));

    await waitFor(() => expect(stageToggle('Triage')).toHaveAttribute('aria-expanded', 'true'));
    expect(stageToggle('Planning')).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.getByText('Moved recently')).toBeVisible());
  });

  it('reveals the group again when a link to another comment on the same issue arrives', async () => {
    const router = renderBoard();
    const user = userEvent.setup();
    await screen.findByText('Moved recently');
    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?item=recent-card&comment=comment-a`));
    await user.click(stageToggle('Triage'));
    expect(stageToggle('Triage')).toHaveAttribute('aria-expanded', 'false');

    await act(() => router.navigate(`/factories/${FACTORY_ID}/work?item=recent-card&comment=comment-b`));

    await waitFor(() => expect(stageToggle('Triage')).toHaveAttribute('aria-expanded', 'true'));
  });

  it.each([
    { width: 'wide', narrowQuery: undefined },
    { width: 'too narrow to dock', narrowQuery: '(max-width: 1279px)' },
  ])('toggles the details panel from its row and switches it to another row ($width)', async ({ narrowQuery }) => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: query === narrowQuery,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    renderBoard();
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    const movedRow = await within(triage).findByText('Moved recently');
    const createdRow = within(triage).getByText('Created later');

    await user.click(movedRow);
    expect(await screen.findByRole('dialog', { name: 'Moved recently' })).toBeInTheDocument();
    await user.click(movedRow);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(movedRow);
    await screen.findByRole('dialog', { name: 'Moved recently' });
    await user.click(createdRow);
    expect(await screen.findByRole('dialog', { name: 'Created later' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Moved recently' })).not.toBeInTheDocument());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('closes the docked panel on Escape from its composer and puts focus back on the row', async () => {
    renderBoard();
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    await user.click(await within(triage).findByText('Moved recently'));
    const panel = await screen.findByRole('dialog', { name: 'Moved recently' });

    await user.click(within(panel).getByRole('textbox', { name: 'Comment' }));
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(triage).getByRole('article', { name: 'Moved recently' })).toHaveFocus();
  });

  it('moves focus into the docked panel when a row opens from the keyboard', async () => {
    renderBoard();
    const user = userEvent.setup();
    const details = await screen.findByRole('button', { name: 'Details for Moved recently' });
    act(() => details.focus());

    await user.keyboard('{Enter}');

    const panel = await screen.findByRole('dialog', { name: 'Moved recently' });
    await waitFor(() => expect(panel).toHaveFocus());
  });

  it('opens only the clicked copy of an item that sits in two stages', async () => {
    renderBoard();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            {
              ...workItem('split-card', 'In two stages', '2026-08-01T00:00:00.000Z', '2026-08-04T00:00:00.000Z'),
              stages: ['triage', 'planning'],
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    const triage = await screen.findByTestId('board-column-triage');
    expect(await within(screen.getByTestId('board-column-planning')).findByText('In two stages')).toBeInTheDocument();

    await user.click(await within(triage).findByText('In two stages'));

    await screen.findByRole('dialog', { name: 'In two stages' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('keeps one card open on the kanban board when another card opens', async () => {
    renderBoard();
    const user = userEvent.setup();
    await screen.findByText('Moved recently');
    await saveKanbanView(user);

    await user.click(await screen.findByRole('button', { name: 'Details for Moved recently' }));
    await screen.findByRole('dialog', { name: 'Moved recently' });
    await user.click(screen.getByRole('button', { name: 'Details for Created later' }));

    await screen.findByRole('dialog', { name: 'Created later' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Moved recently' })).not.toBeInTheDocument());
  });
});
