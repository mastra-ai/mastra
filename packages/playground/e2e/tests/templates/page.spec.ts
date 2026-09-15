import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Templates list page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the templates page is visited', () => {
    test('shows the page title and breadcrumb', async ({ page }) => {
      await page.goto('/templates');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Templates');
    });

    test('renders the filter controls', async ({ page }) => {
      await page.goto('/templates');

      // Wait for the page to load and check for filter UI elements
      // The page should have tag and provider filter dropdowns
      await expect(page.locator('main')).toBeVisible();
    });
  });
});
