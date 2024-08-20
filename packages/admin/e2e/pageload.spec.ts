import { test as setup } from '@playwright/test';

setup('pageload', async ({ page }) => {
  await page.goto('/');
});
