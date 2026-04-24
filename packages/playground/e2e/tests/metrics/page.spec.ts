import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('renders metrics dashboard with title and date preset', async ({ page }) => {
  await page.goto('/metrics');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1').first()).toHaveText('Metrics');
  await expect(page.getByRole('button', { name: 'Last 24 hours' })).toBeVisible();
});

test('renders memory KPI cards and Memory card with thread/resource tabs', async ({ page }) => {
  await page.goto('/metrics');

  await expect(page.getByText('Active Threads', { exact: true })).toBeVisible();
  await expect(page.getByText('Active Resources', { exact: true })).toBeVisible();

  const memoryCard = page.getByText('Memory', { exact: true });
  await expect(memoryCard).toBeVisible();

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

  await page.getByRole('button', { name: 'Last 24 hours' }).click();
  await page.getByRole('menuitem', { name: 'Last 7 days' }).click();

  await expect(page).toHaveURL(/period=7d/);
});
