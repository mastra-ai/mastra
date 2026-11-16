import { act, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect } from 'vitest';

export async function openPropertiesMenu(user: UserEvent, menuLabel: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${menuLabel}`) }));
  return screen.findByRole('menu');
}

export async function openPropertySubmenu(user: UserEvent, menuLabel: string, property: string) {
  await openPropertiesMenu(user, menuLabel);
  const submenuTrigger = await screen.findByRole('menuitem', { name: new RegExp(`^${property}`) });
  // jsdom has no geometry: pointer travel into a submenu leaves Base UI's safe polygon and closes it.
  act(() => submenuTrigger.focus());
  await user.keyboard('{ArrowRight}');
  await waitFor(() => expect(screen.getAllByRole('menu')).toHaveLength(2));
}

export async function closePropertiesMenus(user: UserEvent) {
  while (screen.queryAllByRole('menu').length > 0) {
    const openMenus = screen.queryAllByRole('menu').length;
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryAllByRole('menu')).toHaveLength(openMenus - 1));
  }
}

export async function pickPropertyOption(user: UserEvent, menuLabel: string, property: string, option: string) {
  await openPropertySubmenu(user, menuLabel, property);
  await user.click(await screen.findByRole('menuitemradio', { name: option }));
  await closePropertiesMenus(user);
}

export async function togglePropertyOption(
  user: UserEvent,
  menuLabel: string,
  property: string,
  option: string | RegExp,
) {
  await openPropertySubmenu(user, menuLabel, property);
  await user.click(await screen.findByRole('menuitemcheckbox', { name: option }));
  await closePropertiesMenus(user);
}
