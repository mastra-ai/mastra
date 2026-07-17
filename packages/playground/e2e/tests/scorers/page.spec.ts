import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Scorers list page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the scorers page is visited', () => {
    test('shows the scorers in the evaluation dashboard', async ({ page }) => {
      await page.goto('/scorers');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expect(page.getByRole('searchbox', { name: 'Search scorers' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Response Quality Scorer/i })).toBeVisible();
    });
  });

  test.describe('when a scorer row is clicked', () => {
    test('navigates to that scorer detail page', async ({ page }) => {
      await page.goto('/scorers');

      await page.getByRole('link', { name: /Response Quality Scorer/i }).click();

      await expect(page).toHaveURL(/\/scorers\/response-quality$/);
    });
  });
});
