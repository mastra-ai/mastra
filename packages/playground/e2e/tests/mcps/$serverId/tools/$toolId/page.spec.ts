import { test, expect } from '@playwright/test';
import { resetStorage } from '../../../../__utils__/reset-storage';

test.describe('MCP server tool detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when an MCP server tool is executed', () => {
    test('returns the tool output for the submitted input', async ({ page }) => {
      // The old MCP tool URL lands on the server page with the tool open in the drawer.
      await page.goto('/mcps/simple-mcp-server/tools/simpleMcpTool');
      await expect(page).toHaveURL(/\/mcps\/simple-mcp-server\?tool=simpleMcpTool$/);

      await page.getByRole('tab', { name: 'Playground' }).click();
      await expect(page.getByText('No response yet')).toBeVisible();

      await page.getByLabel('The name of the person').fill('John Doe');
      await page.getByRole('button', { name: 'Run' }).click();

      await expect(page.getByText('Success')).toBeVisible();
      await expect(page.locator('pre')).toContainText('"result"');
      await expect(page.locator('pre')).toContainText('"thisIsA": "fixture"');
    });
  });
});
