import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectBreadcrumbLink, expectRouteDocsLink } from '../../__utils__/route-header';

test.describe('MCP server detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when an MCP server detail page is visited', () => {
    test('has breadcrumb navigation back to the servers list', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server');

      await expect(page).toHaveTitle(/Mastra Studio/);

      await expectBreadcrumbLink(page, 'MCP Servers', '/mcps');
    });

    test('has a documentation link', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server');

      await expectRouteDocsLink(page, 'MCP documentation', 'https://mastra.ai/en/docs/tools-mcp/mcp-overview');
    });

    test('has a server combobox for navigation', async ({ page }) => {
      await page.goto('/mcps/simple-mcp-server');

      // The MCP server combobox should be visible
      const combobox = page.locator('[role="combobox"]');
      await expect(combobox).toBeVisible();
    });
  });
});
