import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has page title', async ({ page }) => {
  await page.goto('/settings');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Settings');
});

test('renders settings form', async ({ page }) => {
  await page.goto('/settings');

  // The settings form should be visible with configuration options
  const form = page.locator('form');
  await expect(form).toBeVisible();
});
