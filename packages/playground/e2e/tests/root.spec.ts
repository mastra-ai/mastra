import { test, expect } from '@playwright/test';
import { resetStorage } from './__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('root path redirects to agents', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/agents$/);
});

test('non-existent path shows 404', async ({ page }) => {
  await page.goto('/this-path-does-not-exist');
  await expect(page.getByTestId('route-error')).toBeVisible();
  await expect(page.locator('h3')).toHaveText('Page not found');
});
