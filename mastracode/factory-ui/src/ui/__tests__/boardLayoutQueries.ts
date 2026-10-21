import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** A list group's heading toggle, named by its stage label and, once loaded, its count. */
export function stageToggle(label: string, container: HTMLElement = document.body): HTMLElement {
  return within(container).getByRole('button', { name: new RegExp(`^${label}(, \\d+)?$`) });
}

/** Saves what the board shows as a view named "Untitled view", and waits until it is the active view. */
export async function createBoardView(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Create new view…' }));
  await confirmNewViewName(user);
}

/** Accepts the suggested name of a view being created (after "Create new view…" or "Save as view"). */
export async function confirmNewViewName(user: UserEvent): Promise<void> {
  await screen.findByRole('textbox', { name: 'View name' });
  await user.keyboard('{Enter}');
  await screen.findByRole('button', { name: 'Untitled view', pressed: true });
}

/** Boards open as a list; Kanban is a saved view's layout. */
export async function saveKanbanView(user: UserEvent): Promise<void> {
  await createBoardView(user);
  await user.click(await screen.findByRole('radio', { name: 'Board' }));
  await user.click(screen.getByRole('button', { name: 'Save to this view' }));
  await screen.findByRole('group', { name: 'Board columns' });
}
