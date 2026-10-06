import type { Page } from '@playwright/test';

export async function openSidebarMoreMenu(page: Page) {
  const more = page.getByRole('button', { name: /^More$/i });
  if (await more.isVisible()) {
    await more.click();
  }
}

export function sidebarDestination(page: Page, name: RegExp) {
  return page.getByRole('link', { name }).or(page.getByRole('menuitem', { name }));
}
