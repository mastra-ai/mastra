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

test('has processor combobox for navigation', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  // The processor combobox should allow navigation between processors
  const combobox = page.getByRole('combobox').filter({ hasText: 'Logging Processor' });
  await expect(combobox).toBeVisible();
});

test('has documentation link', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  await expect(page.locator('text=Processors documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/docs/agents/processors',
  );
});
