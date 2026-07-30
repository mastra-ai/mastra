import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb, expectRouteDocsLink } from '../__utils__/route-header';

test.describe('Processors list page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the processors page is visited', () => {
    test('shows the page header and docs link', async ({ page }) => {
      await page.goto('/processors');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Processors');
      await expectRouteDocsLink(page, 'Processors documentation', 'https://mastra.ai/en/docs/agents/processors');
    });
  });

  test.describe('when a processor row is clicked', () => {
    test('navigates to that processor detail page', async ({ page }) => {
      await page.goto('/processors');

      const el = page.locator('.data-list-row:has-text("Logging Processor")');
      await el.click();

      await expect(page).toHaveURL(/\/processors\/logging-processor$/);
    });
  });
});
