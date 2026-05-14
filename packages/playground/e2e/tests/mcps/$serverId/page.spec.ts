import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectBreadcrumbLink, expectRouteDocsLink } from '../../__utils__/route-header';

test.afterEach(async () => {
  await resetStorage();
});

test('has breadcrumb navigation', async ({ page }) => {
  await page.goto('/mcps/simple-mcp-server');

  await expect(page).toHaveTitle(/Mastra Studio/);

  await expectBreadcrumbLink(page, 'MCP Servers', '/mcps');
});

test('has documentation link', async ({ page }) => {
  await page.goto('/mcps/simple-mcp-server');

  await expectRouteDocsLink(page, 'MCP documentation', 'https://mastra.ai/en/docs/tools-mcp/mcp-overview');
});

test('has server combobox for navigation', async ({ page }) => {
  await page.goto('/mcps/simple-mcp-server');

  // The MCP server combobox should be visible
  const combobox = page.locator('[role="combobox"]');
  await expect(combobox).toBeVisible();
});
