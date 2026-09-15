import { test, expect } from '@playwright/test';
import { resetStorage } from './__utils__/reset-storage';

test.describe('Root path', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the root path is visited', () => {
    test('redirects to agents', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/agents$/);
    });
  });
});
