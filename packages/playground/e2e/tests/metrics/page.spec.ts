import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('renders metrics dashboard with title and date preset', async ({ page }) => {
  await page.goto('/metrics');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1').first()).toHaveText('Metrics');
  await expect(page.getByRole('combobox').filter({ hasText: 'Last 24 hours' })).toBeVisible();
});

test('renders Memory card with thread/resource tabs when metrics are available', async ({ page }) => {
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

test('persists dimensional filter as URL param', async ({ page }) => {
  await page.goto('/metrics?filterEnvironment=production');

  await expect(page).toHaveURL(/filterEnvironment=production/);
  // The toolbar should show the active filter pill
  await expect(page.getByText('production')).toBeVisible();
});

test('changing date preset updates URL', async ({ page }) => {
  await page.goto('/metrics');

  await page.getByRole('combobox').filter({ hasText: 'Last 24 hours' }).click();
  await page.getByRole('option', { name: 'Last 7 days' }).click();

  await expect(page).toHaveURL(/period=7d/);
});
