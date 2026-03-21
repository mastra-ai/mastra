import { test, expect, Page } from '@playwright/test';

/**
 * Wait for a tool result containing the expected key, then parse and return the JSON.
 */
async function waitForToolResult(page: Page, expectedKey: string): Promise<unknown> {
  const jsonPanel = page.locator('[data-language="json"]');
  await expect(jsonPanel).toContainText(expectedKey, { timeout: 10_000 });
  const text = await jsonPanel.textContent();
  if (!text) throw new Error('Tool result panel has no text content');
  return JSON.parse(text);
}

test.describe('MCP Servers', () => {
  test('MCP servers list page shows registered servers', async ({ page }) => {
    await page.goto('/mcps');

    await expect(page.locator('h1')).toHaveText('MCP Servers');

    // The test-mcp server should be listed
    await expect(page.getByRole('link', { name: 'Test MCP Server' })).toBeVisible();

    // It should show 2 tools attached
    await expect(page.getByText('2 tools')).toBeVisible();
  });

  test('MCP server detail shows available tools', async ({ page }) => {
    await page.goto('/mcps/test-mcp');

    // Server heading
    await expect(page.locator('h1')).toHaveText('Test MCP Server');

    // Transport method copy buttons
    await expect(page.getByRole('button', { name: 'Copy HTTP Stream URL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy SSE URL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy Command Line Config' })).toBeVisible();

    // Available tools section
    await expect(page.getByRole('heading', { name: 'Available Tools' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'calculator' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'string-transform' })).toBeVisible();
  });

  test('execute MCP tool from UI', async ({ page }) => {
    await page.goto('/mcps/test-mcp/tools/calculator');

    // Fill the calculator form
    await page.getByRole('combobox', { name: 'Operation' }).click();
    await page.getByRole('option', { name: 'multiply' }).click();

    await page.getByRole('spinbutton', { name: 'A' }).fill('6');
    await page.getByRole('spinbutton', { name: 'B' }).fill('7');
    await page.getByRole('button', { name: 'Submit' }).click();

    // MCP tools wrap the output in an extra { result: ... } envelope
    const result = await waitForToolResult(page, 'result');
    expect(result).toEqual({ result: { result: 42 } });
  });
});
