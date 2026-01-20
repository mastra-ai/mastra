import { test, expect } from '@playwright/test';
import { resetStorage } from '../../../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('verifies a tool s behaviour for agent', async ({ page }) => {
  await page.goto('/agents/weatherAgent/tools/simpleMcpTool');

  await expect(page.locator('h2')).toHaveText('simpleMcpTool');
  await expect(page.locator('[data-language="json"]')).toHaveText('{}');

  await page.getByLabel('The name of the person').fill('John Doe');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.locator('[data-language="json"]')).toHaveText('{  "hello": "world",  "thisIsA": "fixture"}');
});
