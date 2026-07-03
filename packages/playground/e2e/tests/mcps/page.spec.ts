import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb, expectRouteDocsLink } from '../__utils__/route-header';

test.describe('MCP servers list page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the MCP servers page is visited', () => {
    test('shows the page header, docs link, and renders the server list', async ({ page }) => {
      await page.goto('/mcps');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'MCP Servers');
      await expectRouteDocsLink(page, 'MCP documentation', 'https://mastra.ai/en/docs/tools-mcp/mcp-overview');

      // Verify list renders
      await expect(page.locator('.data-list-row').first()).toBeVisible();
    });
  });

  test.describe('when an MCP server row is clicked', () => {
    test('navigates to that server detail page', async ({ page }) => {
      await page.goto('/mcps');

      const el = page.locator('.data-list-row:has-text("Simple MCP Server")');
      await el.click();

      await expect(page).toHaveURL(/\/mcps\/simple-mcp-server.*/);
    });
  });
});
