import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/processors');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Processors');
  await expect(page.locator('a[href="https://mastra.ai/en/docs/agents/processors"]')).toBeVisible();
});

test('clicking on the processor row redirects to detail page', async ({ page }) => {
  await page.goto('/processors');

  const el = page.locator('.entity-list-row:has-text("Logging Processor")');
  await el.click();

  await expect(page).toHaveURL(/\/processors\/logging-processor$/);
});
