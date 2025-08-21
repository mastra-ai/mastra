import { test, expect } from '@playwright/test';

test('has valid links', async ({ page }) => {
  await page.goto('http://localhost:4111/workflows');

  const el = await page.locator('text=weather-workflow');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/workflows/weatherWorkflow/graph');
  await expect(page.locator('h2')).toHaveText('weather-workflow');
});

test('clicking on the weather row redirects', async ({ page }) => {
  await page.goto('http://localhost:4111/workflows');

  const el = await page.locator('tr:has-text("weather-workflow")');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/workflows/weatherWorkflow/graph');
  await expect(page.locator('h2')).toHaveText('weather-workflow');
});
