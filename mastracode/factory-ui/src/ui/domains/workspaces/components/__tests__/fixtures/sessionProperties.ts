import { act, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

/** The sidebar opens ungrouped; suites that exercise board groups start from a stored Board grouping. */
export function groupSessionsByBoard() {
  localStorage.setItem('mastracode.sessionListView', JSON.stringify({ groupBy: 'board' }));
}

export function sessionPropertiesTrigger(changedCount = 0): HTMLElement {
  return screen.getByRole('button', {
    name: changedCount === 0 ? 'Sessions properties' : `Sessions properties, ${changedCount} changed`,
  });
}

export async function openSessionProperties(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: /^Sessions properties/ }));
  return screen.findByRole('menu');
}

export async function openSessionProperty(user: UserEvent, property: string) {
  await openSessionProperties(user);
  await openSubmenu(user, property, 2);
}

export async function openNestedSessionProperty(user: UserEvent, property: string, nested: string) {
  await openSessionProperty(user, property);
  await openSubmenu(user, nested, 3);
}

async function openSubmenu(user: UserEvent, itemName: string, expectedMenus: number) {
  const submenuTrigger = await screen.findByRole('menuitem', { name: new RegExp(`^${itemName}`) });
  // jsdom has no geometry: pointer travel into a submenu leaves Base UI's safe polygon and closes it.
  act(() => submenuTrigger.focus());
  await user.keyboard('{ArrowRight}');
  await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(expectedMenus));
}

export async function closeSessionProperties(user: UserEvent) {
  while (screen.queryAllByRole('menu').length > 0) {
    const openMenus = screen.queryAllByRole('menu').length;
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryAllByRole('menu')).toHaveLength(openMenus - 1));
  }
}

export async function pickSessionProperty(user: UserEvent, property: string, option: string) {
  await openSessionProperty(user, property);
  await user.click(await screen.findByRole('menuitemradio', { name: option }));
  await closeSessionProperties(user);
}
