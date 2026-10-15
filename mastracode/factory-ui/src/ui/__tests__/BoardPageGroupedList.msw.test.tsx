import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { stageToggle } from './boardLayoutQueries';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

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
});
