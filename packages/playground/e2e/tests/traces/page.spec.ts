import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Traces page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the traces page is visited', () => {
    test('shows the page header', async ({ page }) => {
      await page.goto('/traces');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Traces');
    });

    test('shows the filter bar', async ({ page }) => {
      await page.goto('/traces');

      // The typeahead filter input should be present against a real server.
      await expect(page.getByRole('combobox', { name: 'Add filter' })).toBeVisible();
    });
  });
});
