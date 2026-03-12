import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/mcps');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('MCP Servers');
  await expect(page.locator('text=MCP documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/tools-mcp/mcp-overview',
  );

  const list = page.locator('main').getByRole('list');
  await expect(list).toMatchAriaSnapshot();
});

test('clicking on the agent row redirects', async ({ page }) => {
  await page.goto('/mcps');

  const el = page.locator('main').getByRole('listitem').filter({ hasText: 'Simple MCP Server' });
  await el.click();

  await expect(page).toHaveURL(/\/mcps\/simple-mcp-server.*/);
});
