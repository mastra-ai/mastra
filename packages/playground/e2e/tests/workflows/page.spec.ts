import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Workflows list page', () => {
  test.describe('when the complex-workflow link is clicked', () => {
    test('navigates to the complex-workflow graph page', async ({ page }) => {
      await page.goto('/workflows');

      const el = page.locator('text=complex-workflow');
      await el.click();

      await expect(page).toHaveURL(/\/workflows\/complexWorkflow\/graph$/);
      await expect(page.getByText('complex-workflow').first()).toBeVisible();
    });
  });

  test.describe('when the complex-workflow row is clicked', () => {
    test('navigates to the complex-workflow graph page', async ({ page }) => {
      await page.goto('/workflows');

      const el = page.locator('.data-list-row:has-text("complex-workflow")');
      await el.click();

      await expect(page).toHaveURL(/\/workflows\/complexWorkflow\/graph$/);
      await expect(page.getByText('complex-workflow').first()).toBeVisible();
    });
  });
});
