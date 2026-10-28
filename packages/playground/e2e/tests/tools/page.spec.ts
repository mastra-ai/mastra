import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Tools list page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when there are more tools than fit on screen', () => {
    test('scrolls the list under a search field that stays in view', async ({ page }) => {
      await page.route('**/api/tools', async route => {
        const response = await route.fetch();
        const tools: Record<string, { id: string; description?: string }> = await response.json();
        const sample = Object.values(tools)[0];
        const fillers = Object.fromEntries(
          Array.from({ length: 60 }, (_, i) => [
            `filler-${i}`,
            { ...sample, id: `filler-${i}`, description: `Filler tool ${i}` },
          ]),
        );
        await route.fulfill({ response, json: { ...tools, ...fillers } });
      });

      await page.goto('/tools');

      const search = page.getByLabel('Filter tools');
      const list = page.locator('[data-slot="page-layout-fill"]');
      await expect(list.getByText('Filler tool 0', { exact: true })).toBeAttached();
      const searchTop = (await search.boundingBox())?.y ?? 0;

      await list.hover();
      await page.mouse.wheel(0, 600);

      // The rows scroll inside the list; the search above it does not move.
      await expect
        .poll(() => list.evaluate(el => Math.max(0, ...[...el.querySelectorAll('*')].map(e => e.scrollTop))))
        .toBeGreaterThan(100);
      expect((await search.boundingBox())?.y).toBe(searchTop);
    });
  });

  test.describe('when a registered tool is clicked', () => {
    test('opens that tool in a drawer over the list', async ({ page }) => {
      await page.goto('/tools');

      const el = await page.locator('text=Get current weather for a location');
      await el.click();

      await expect(page).toHaveURL(/\/tools\?tool=weatherInfo$/);
      await expect(page.getByRole('heading', { name: 'weatherInfo' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    });
  });
});
