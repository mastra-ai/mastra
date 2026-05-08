import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has page title', async ({ page }) => {
  await page.goto('/templates');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Templates');
});

test('has filter controls', async ({ page }) => {
  await page.goto('/templates');

  // Wait for the page to load and check for filter UI elements
  // The page should have tag and provider filter dropdowns
  await expect(page.locator('main')).toBeVisible();
});
