import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has breadcrumb navigation', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  await expect(page).toHaveTitle(/Mastra Studio/);

  const breadcrumb = page.locator('nav a:has-text("Scorers")').first();
  await expect(breadcrumb).toHaveAttribute('href', '/scorers');
});

test('displays scorer name and has documentation link', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  await expect(page.locator('h1')).toHaveText('Response Quality Scorer');
  await expect(page.locator('text=Scorers documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/evals/overview',
  );
});

test('has entity filter dropdown', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  // The entity filter should be present
  const entityFilter = page.locator('button:has-text("All")');
  await expect(entityFilter).toBeVisible();
});

test('has scorer combobox for navigation', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  // The scorer combobox should allow navigation between scorers
  const combobox = page.getByRole('combobox').filter({ hasText: 'Response Quality Scorer' });
  await expect(combobox).toBeVisible();
});
