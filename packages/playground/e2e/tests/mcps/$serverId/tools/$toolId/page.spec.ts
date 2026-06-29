import { test, expect } from '@playwright/test';
import { resetStorage } from '../../../../__utils__/reset-storage';

test.describe('MCP server tool detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when an MCP server tool is executed', () => {
    test('returns the tool output for the submitted input', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server/tools/simpleMcpTool');

      await expect(page.locator('[data-language="json"]')).toHaveText('{}');

      await page.getByLabel('The name of the person').fill('John Doe');
      await page.getByRole('button', { name: 'Submit' }).click();

      await expect(page.locator('[data-language="json"]')).toHaveText(
        '{  "result": {    "hello": "world",    "thisIsA": "fixture"  }}',
      );
    });
  });
});
