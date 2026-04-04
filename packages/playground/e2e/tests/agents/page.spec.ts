import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/agents');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Agents');
  await expect(page.locator('a[href="https://mastra.ai/en/docs/agents/overview"]')).toBeVisible();

  // Verify agent list renders with at least one agent
  await expect(page.locator('.entity-list-row').first()).toBeVisible();
});

test('clicking on the agent row redirects', async ({ page }) => {
  await page.goto('/agents');

  const el = page.locator('a:has-text("Weather Agent")');
  await el.click();

  await expect(page).toHaveURL(/\/agents\/weather-agent\/chat.*/);
});
