import { test, expect } from '@playwright/test';

test('has valid links', async ({ page }) => {
  await page.goto('http://localhost:4111/tools');

  const el = await page.locator('text=get-weather');
  const attachedAgent = await page.locator('text=Weather Agent');
  await expect(attachedAgent).toBeVisible();

  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/tools/weatherAgent/get-weather');
  await expect(page.locator('h2')).toHaveText('get-weather');
});

test('clicking on the tool box redirects to the tool page', async ({ page }) => {
  await page.goto('http://localhost:4111/tools');

  const el = await page.locator('text=Get current weather for a location');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/tools/weatherAgent/get-weather');
  await expect(page.locator('h2')).toHaveText('get-weather');
});

test('clicking on the agent redirects to the agent page', async ({ page }) => {
  await page.goto('http://localhost:4111/tools');

  const el = await page.locator('text=Weather Agent');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/agents/weatherAgent/chat');
});
