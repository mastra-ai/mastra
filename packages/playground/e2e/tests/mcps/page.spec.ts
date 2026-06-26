import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb, expectRouteDocsLink } from '../__utils__/route-header';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/mcps');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expectCurrentBreadcrumb(page, 'MCP Servers');
  await expectRouteDocsLink(page, 'MCP documentation', 'https://mastra.ai/en/docs/tools-mcp/mcp-overview');

  // Verify list renders
  await expect(page.locator('.data-list-row').first()).toBeVisible();
});

test('clicking on the agent row redirects', async ({ page }) => {
  await page.goto('/mcps');

  const el = page.locator('.data-list-row:has-text("Simple MCP Server")');
  await el.click();

  await expect(page).toHaveURL(/\/mcps\/simple-mcp-server.*/);
});
