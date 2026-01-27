import { test, expect } from '@playwright/test';
import { resetStorage } from './__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('root path redirects to agents', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/agents$/);
});
