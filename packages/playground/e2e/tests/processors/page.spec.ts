import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb, expectRouteDocsLink } from '../__utils__/route-header';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/processors');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expectCurrentBreadcrumb(page, 'Processors');
  await expectRouteDocsLink(page, 'Processors documentation', 'https://mastra.ai/en/docs/agents/processors');
});

test('clicking on the processor row redirects to detail page', async ({ page }) => {
  await page.goto('/processors');

  const el = page.locator('.data-list-row:has-text("Logging Processor")');
  await el.click();

  await expect(page).toHaveURL(/\/processors\/logging-processor$/);
});
