import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** A list group's heading toggle, named by its stage label and, once loaded, its count. */
export function stageToggle(label: string, container: HTMLElement = document.body): HTMLElement {
  return within(container).getByRole('button', { name: new RegExp(`^${label}(, \\d+)?$`) });
}

/** Boards open as a list; Kanban is a saved view's layout. */
export async function saveKanbanView(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'New view' }));
  await user.click(await screen.findByRole('radio', { name: 'Board' }));
  await user.click(screen.getByRole('button', { name: 'Save view' }));
  await screen.findByRole('group', { name: 'Board columns' });
}
