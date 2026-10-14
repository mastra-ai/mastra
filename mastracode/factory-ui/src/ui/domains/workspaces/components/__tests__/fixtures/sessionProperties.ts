import { act, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

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
  const propertyRow = await screen.findByRole('menuitem', { name: new RegExp(`^${property}`) });
  // jsdom has no geometry: pointer travel into a submenu leaves Base UI's safe polygon and closes it.
  act(() => propertyRow.focus());
  await user.keyboard('{ArrowRight}');
  await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(2));
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
