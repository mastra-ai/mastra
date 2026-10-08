import { test, expect } from '@playwright/test';

/** Execution controls must remain reachable without scrolling the header or main pane. */
test.describe('Contextual navigation scrolling', () => {
  test.describe('when processor controls exceed the available sidebar height', () => {
    test('reveals the run action while keeping back navigation in place', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 280 });
      await page.goto('/processors/content-filter');
      const sidebar = page.getByRole('complementary', { name: 'Processors navigation', exact: true });
      const header = sidebar.locator('header').first();
      const action = sidebar.getByRole('button', { name: 'Run processor' });
      await expect(action).toBeAttached();
      const headerPosition = await header.boundingBox();
      const bounds = await sidebar.boundingBox();
      if (!headerPosition || !bounds) throw new Error('The sidebar must be visible');
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height - 24);
      await page.mouse.wheel(0, 4000);
      await expect
        .poll(async () => {
          const item = await action.boundingBox();
          return Boolean(item && item.y >= bounds.y && item.y + item.height <= bounds.y + bounds.height);
        })
        .toBe(true);
      await expect.poll(async () => (await header.boundingBox())?.y).toBe(headerPosition.y);
    });
  });
});
