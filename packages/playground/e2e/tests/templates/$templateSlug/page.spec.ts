import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.describe('Template detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a template detail page is visited', () => {
    test('has breadcrumb navigation back to the templates list', async ({ page }) => {
      // Use a mock template slug - the page should still render breadcrumbs
      await page.goto('/templates/test-template');

      await expect(page).toHaveTitle(/Mastra Studio/);

      const breadcrumb = page.locator('nav a:has-text("Templates")').first();
      await expect(breadcrumb).toHaveAttribute('href', '/templates');
    });
  });
});
