import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Tools list page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a registered tool is clicked', () => {
    test('navigates to that tool detail page and shows its name as the heading', async ({ page }) => {
      await page.goto('/tools');

      const el = await page.locator('text=Get current weather for a location');
      await el.click();

      await expect(page).toHaveURL(/\/tools\/weatherInfo$/);
      await expect(page.locator('h2')).toHaveText('weatherInfo');
    });
  });
});
