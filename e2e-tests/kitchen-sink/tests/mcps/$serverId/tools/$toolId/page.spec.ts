import { test, expect } from '@playwright/test';
import { resetStorage } from '../../../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('verifies a tool s behaviour for mcp server', async ({ page }) => {
  await page.goto('http://localhost:4111/mcps/simple-mcp-server/tools/simpleMcpTool');

  await expect(page.locator('[data-language="json"]')).toHaveText('{}');

  await page.getByLabel('The name of the person').fill('John Doe');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.locator('[data-language="json"]')).toHaveText(
    '{  \"result\": {    \"hello\": \"world\",    \"thisIsA\": \"fixture\"  }}',
  );
});
