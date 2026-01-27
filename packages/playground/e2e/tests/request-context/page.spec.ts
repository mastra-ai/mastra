import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has page title', async ({ page }) => {
  await page.goto('/request-context');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Request Context');
});

test('renders RequestContext component', async ({ page }) => {
  await page.goto('/request-context');

  // The RequestContext component should be rendered within the page
  // Check for the main content area
  const mainContent = page.locator('main');
  await expect(mainContent).toBeVisible();
});
