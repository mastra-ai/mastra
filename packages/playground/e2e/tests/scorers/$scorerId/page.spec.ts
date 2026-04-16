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

  const entityFilter = page.locator('main').getByRole('combobox').nth(1);
  await expect(entityFilter).toBeVisible();
  await expect(entityFilter).toContainText('All Entities');
});

test('has scorer combobox for navigation', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  const combobox = page.locator('nav').getByRole('combobox').first();
  await expect(combobox).toBeVisible();
  await expect(combobox).toContainText('Response Quality Scorer');
});
