import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Tools list page', () => {
  test.afterEach(async () => {
    await resetStorage();
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
