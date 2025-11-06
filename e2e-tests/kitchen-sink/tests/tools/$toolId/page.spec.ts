import { test, expect } from '@playwright/test';

test('verifies a tool s behaviour', async ({ page }) => {
  await page.goto('http://localhost:4111/tools/simpleMcpTool');

  await expect(page.locator('h2')).toHaveText('simpleMcpTool');
  await expect(page.locator('[data-language="json"]')).toHaveText('{}');

  await page.getByLabel('The name of the person').fill('John Doe');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.locator('[data-language="json"]')).toHaveText(
    '{  \"hello\": \"world\",  \"thisIsA\": \"fixture\"}',
  );
});
