import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Metrics dashboard page', () => {
  test.describe('when the metrics page is opened', () => {
    test('renders the dashboard with title and date preset', async ({ page }) => {
      await page.goto('/metrics');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Metrics');
      await expect(page.getByRole('button', { name: 'Last 24 hours' })).toBeVisible();
    });
  });

  test.describe('when memory metrics are available', () => {
    test('renders the Memory card with thread/resource tabs', async ({ page }) => {
      await page.goto('/metrics');

      const unsupportedStorageNotice = page.getByRole('heading', {
        name: 'Metrics are not available with your current storage',
      });
      await page
        .getByRole('heading', { name: /^(Memory|Metrics are not available with your current storage)$/ })
        .first()
        .waitFor();
      test.skip(
        await unsupportedStorageNotice.isVisible(),
        'Metrics are not available with the current kitchen-sink storage',
      );

      await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();

      await expect(page.getByRole('tab', { name: 'Threads' })).toBeVisible();
      const resourcesTab = page.getByRole('tab', { name: 'Resources' });
      await expect(resourcesTab).toBeVisible();

      await resourcesTab.click();
      await expect(resourcesTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('when a dimensional filter is present in the URL', () => {
    test('persists the dimensional filter as a URL param', async ({ page }) => {
      await page.goto('/metrics?filterEnvironment=production');

      await expect(page).toHaveURL(/filterEnvironment=production/);
      // The toolbar should show the active filter pill
      await expect(page.getByText('production')).toBeVisible();
    });
  });

  test.describe('when the date preset is changed', () => {
    test('updates the URL with the new period', async ({ page }) => {
      await page.goto('/metrics');

      await page.getByRole('button', { name: 'Last 24 hours' }).click();
      await page.getByRole('menuitem', { name: 'Last 7 days' }).click();

      await expect(page).toHaveURL(/period=7d/);
    });
  });
});
