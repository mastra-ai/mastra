import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/scorers');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Scorers');
  await expect(page.getByRole('link', { name: 'Scorers documentation' })).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/evals/overview',
  );
});

test('clicking on the scorer row redirects to detail page', async ({ page }) => {
  await page.goto('/scorers');

  const el = page.locator('tr:has-text("Response Quality Scorer")');
  await el.click();

  await expect(page).toHaveURL(/\/scorers\/response-quality$/);
});
