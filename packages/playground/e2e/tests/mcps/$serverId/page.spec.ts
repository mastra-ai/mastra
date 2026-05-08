import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has breadcrumb navigation', async ({ page }) => {
  await page.goto('/mcps/simple-mcp-server');

  await expect(page).toHaveTitle(/Mastra Studio/);

  const breadcrumb = page.locator('nav a:has-text("MCP Servers")').first();
  await expect(breadcrumb).toHaveAttribute('href', '/mcps');
});

test('has documentation link', async ({ page }) => {
  await page.goto('/mcps/simple-mcp-server');

  await expect(page.locator('text=MCP documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/tools-mcp/mcp-overview',
  );
});

test('has server combobox for navigation', async ({ page }) => {
  await page.goto('/mcps/simple-mcp-server');

  // The MCP server combobox should be visible
  const combobox = page.locator('[role="combobox"]');
  await expect(combobox).toBeVisible();
});
