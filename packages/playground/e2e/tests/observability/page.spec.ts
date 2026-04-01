import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/observability');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1').first()).toHaveText('Observability');
  await expect(page.getByRole('link', { name: 'Observability documentation' })).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/observability/tracing/overview',
  );
});

test('has page header with description', async ({ page }) => {
  await page.goto('/observability');

  // The page header with description should be visible
  await expect(page.locator('text=Explore observability traces for your entities')).toBeVisible();
});

test('has filter dropdown', async ({ page }) => {
  await page.goto('/observability');

  // The unified filter dropdown button should be present
  const filterButton = page.getByRole('button', { name: 'Filter' });
  await expect(filterButton).toBeVisible();
});

test('renders empty state or traces list', async ({ page }) => {
  await page.goto('/observability');

  // Either shows empty state or traces list (depending on data)
  // We check that the page has loaded and the traces tools are visible
  await expect(page.locator('text=Reset')).toBeVisible();
  // The date preset dropdown defaults to "Last 24 hours"
  await expect(page.getByRole('button', { name: 'Last 24 hours' })).toBeVisible();
});
