import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has breadcrumb navigation', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  await expect(page).toHaveTitle(/Mastra Studio/);

  const breadcrumb = page.locator('nav a:has-text("Processors")').first();
  await expect(breadcrumb).toHaveAttribute('href', '/processors');
});

test('displays processor ID in header', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  // The processor ID should be displayed in the header group
  await expect(page.locator('header').getByText('logging-processor')).toBeVisible();
});

test('has documentation link', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  await expect(page.locator('text=Processors documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/docs/agents/processors',
  );
});
