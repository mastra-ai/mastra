import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has valid links', async ({ page }) => {
  await page.goto('/workflows');

  const el = page.locator('text=complex-workflow');
  await el.click();

  await expect(page).toHaveURL(/\/workflows\/complexWorkflow\/graph$/);
  await expect(page.getByText('complex-workflow').first()).toBeVisible();
});

test('clicking on the complex-workflow row redirects', async ({ page }) => {
  await page.goto('/workflows');

  const el = page.locator('.data-list-row:has-text("complex-workflow")');
  await el.click();

  await expect(page).toHaveURL(/\/workflows\/complexWorkflow\/graph$/);
  await expect(page.getByText('complex-workflow').first()).toBeVisible();
});
