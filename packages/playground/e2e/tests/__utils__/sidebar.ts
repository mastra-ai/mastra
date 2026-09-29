import { expect, type Page } from '@playwright/test';

/**
 * Low-traffic primitives (Processors, MCP Servers, Tools, Workspaces) sit behind
 * a "More" row in the sidebar unless recently visited or backed by server data.
 * Wait for the fold area to resolve, then reveal any folded items.
 */
export async function revealFoldedSidebarItems(page: Page) {
  await expect(page.getByTestId('nav-more-skeleton')).toHaveCount(0);
  const more = page.getByRole('button', { name: /^More$/i });
  if (await more.isVisible()) {
    await more.click();
  }
}
