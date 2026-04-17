import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('shows scorers in the evaluation dashboard', async ({ page }) => {
  await page.goto('/scorers');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.getByRole('textbox', { name: 'Filter by scorer name' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Response Quality Scorer/i })).toBeVisible();
});

test('clicking on the scorer row redirects to detail page', async ({ page }) => {
  await page.goto('/scorers');

  await page.getByRole('link', { name: /Response Quality Scorer/i }).click();

  await expect(page).toHaveURL(/\/scorers\/response-quality$/);
});
