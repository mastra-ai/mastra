import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('clicking on the tool box redirects to the tool page', async ({ page }) => {
  await page.goto('/tools');

  const el = await page.locator('text=Get current weather for a location');
  await el.click();

  await expect(page).toHaveURL(/\/tools\/weatherInfo$/);
  await expect(page.locator('h2')).toHaveText('weatherInfo');
});
