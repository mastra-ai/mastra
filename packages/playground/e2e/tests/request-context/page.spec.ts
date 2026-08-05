import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Request Context page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the request-context page is visited', () => {
    test('shows the page title and breadcrumb', async ({ page }) => {
      await page.goto('/request-context');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Request Context');
    });

    test('renders the RequestContext component', async ({ page }) => {
      await page.goto('/request-context');

      // The RequestContext component should be rendered within the page
      // Check for the main content area
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
    });
  });
});
