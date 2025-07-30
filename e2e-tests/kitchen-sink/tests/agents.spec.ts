import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('http://localhost:4111/agents');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Mastra Playground/);
});

test('has valid links', async ({ page }) => {
  await page.goto('http://localhost:4111/agents');

  const el = await page.locator('text=Weather Agent');
  await expect(el).toHaveAttribute('href', '/agents/weatherAgent/chat/new');
});

test('clicking on the agent row redirects', async ({ page }) => {
  await page.goto('http://localhost:4111/agents');

  const el = await page.locator('tr:has-text("Weather Agent")');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/agents/weatherAgent/chat/new');
});
