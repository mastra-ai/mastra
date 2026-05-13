import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectBreadcrumbLink, expectRouteDocsLink } from '../../__utils__/route-header';

test.afterEach(async () => {
  await resetStorage();
});

test('has breadcrumb navigation', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  await expect(page).toHaveTitle(/Mastra Studio/);

  await expectBreadcrumbLink(page, 'Processors', '/processors');
});

test('has processor combobox for navigation', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  // The processor combobox should allow navigation between processors
  const combobox = page.getByRole('combobox').filter({ hasText: 'Logging Processor' });
  await expect(combobox).toBeVisible();
});

test('has documentation link', async ({ page }) => {
  await page.goto('/processors/logging-processor');

  await expectRouteDocsLink(page, 'Processors documentation', 'https://mastra.ai/en/docs/agents/processors');
});
