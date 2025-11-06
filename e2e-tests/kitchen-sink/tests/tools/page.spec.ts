import { test, expect } from '@playwright/test';

test('clicking on the tool box redirects to the tool page', async ({ page }) => {
  await page.goto('http://localhost:4111/tools');

  const el = await page.locator('text=Get current weather for a location');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/tools/weatherInfo');
  await expect(page.locator('h2')).toHaveText('weatherInfo');
});
